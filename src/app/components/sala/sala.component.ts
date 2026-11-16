import { Component, HostListener, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { Senal, ServicesalaService } from 'src/app/services/servicesala.service';
import { ToastService } from 'src/app/services/toast.service';
import { AuthService } from 'src/app/services/auth.service';

interface Participante {
  id: string
  nombre: string
  stream: MediaStream
  pc: RTCPeerConnection
  conectado: boolean
  iniciador: boolean      // quien llamó primero es quien reintenta si la conexión se cae
  reconectando: boolean   // la conexión se cayó un momento: se muestra un aviso sin tapar el video
  tieneVideo: boolean     // llegan imágenes de su cámara (si no, se muestra su inicial)
  reintentando: boolean
  compartiendo: boolean   // está compartiendo su pantalla: se muestra completa, sin recortar
  camaraApagada: boolean  // apagó su cámara: se muestra su inicial en vez de un recuadro negro
  hablando: boolean       // se oye su micrófono: su recuadro se pone verde
}

type Fase = 'cargando' | 'noexiste' | 'expirada' | 'lobby' | 'llamada' | 'fin'

@Component({
  selector: 'app-sala',
  templateUrl: './sala.component.html',
  styleUrls: ['./sala.component.css']
})
export class SalaComponent implements OnInit, OnDestroy {
  public codigo = ''
  public fase: Fase = 'cargando'
  public nombre = ''
  public nombreSala = ''

  public local: MediaStream | null = null     // cámara y micrófono
  public vistaLocal: MediaStream | null = null // lo que se ve en mi recuadro (cámara o pantalla)
  public tieneVideo = false
  public tieneAudio = false
  public micActivo = true
  public camActivo = true
  public compartiendo = false
  public avisoPermisos = ''

  public participantes: Participante[] = []
  public copiado = false

  // Solo quien inició sesión en el panel ve el botón de notas (los invitados no)
  public esAdmin = this.auth.sesionValida
  public idexpediente: string | null = null

  private yo = this.nuevoId()
  private desde = 0
  private activo = false
  private pantalla: MediaStream | null = null
  private pendientes = new Map<string, RTCIceCandidateInit[]>()

  // Audio claro: cancelación de eco, reducción de ruido y volumen automático
  private audioConstraints: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }

  // Con STUN solo funciona en la mayoría de redes; el servidor TURN (lo pide el backend) cubre datos móviles y redes restrictivas.
  private rtcConfig: RTCConfiguration = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  }

  constructor(
    private route: ActivatedRoute,
    private service: ServicesalaService,
    private clientes: ServiceclientesService,
    private toast: ToastService,
    private zone: NgZone,
    private auth: AuthService
  ) { }

  ngOnInit(): void {
    this.codigo = (this.route.snapshot.paramMap.get('codigo') ?? '').toLowerCase()
    const n = localStorage.getItem('nombre')
    const a = localStorage.getItem('apellido')
    this.nombre = [n, a].filter(Boolean).join(' ')

    // Se piden los servidores TURN mientras estás en la sala previa; si falla se queda con STUN
    this.service.obtenerIce().subscribe({
      next: (r) => { if (Array.isArray(r?.iceServers) && r.iceServers.length) this.rtcConfig = { iceServers: r.iceServers } },
      error: () => { /* se queda con STUN */ }
    })

    this.service.obtenerSala(this.codigo).subscribe({
      next: (resp) => {
        this.nombreSala = resp.data?.nombre ?? ''
        this.idexpediente = resp.data?.idexpediente ?? null
        // La nota flotante deja seleccionado al cliente de esta reunión
        if (this.esAdmin && this.idexpediente) this.clientes.clienteContexto.next(this.idexpediente)
        this.fase = 'lobby'
        this.iniciarVistaPrevia()
      },
      error: (err) => { this.fase = err?.status === 410 ? 'expirada' : 'noexiste' }
    })
  }

  ngOnDestroy(): void {
    if (this.esAdmin) this.clientes.clienteContexto.next(null)
    this.cerrarTodo(true)
  }

  @HostListener('window:beforeunload')
  alCerrarPestana() {
    if (this.activo) this.service.avisarSalida(this.codigo, this.yo)
  }

  get enlace() {
    return `${window.location.origin}/sala/${this.codigo}`
  }

  // ================= Cámara y micrófono =================
  private async iniciarVistaPrevia() {
    const intentos: MediaStreamConstraints[] = [
      { video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 }, facingMode: 'user' }, audio: this.audioConstraints },
      // Si la cámara no da HD, se acepta lo que tenga
      { video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' }, audio: this.audioConstraints },
      { video: false, audio: this.audioConstraints },
      { video: true, audio: false }
    ]
    for (const c of intentos) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c)
        this.local = stream
        this.vistaLocal = this.soloVideo(stream)
        break
      } catch { /* prueba la siguiente combinación */ }
    }
    this.tieneVideo = !!this.local?.getVideoTracks().length
    this.tieneAudio = !!this.local?.getAudioTracks().length
    this.micActivo = this.tieneAudio
    this.camActivo = this.tieneVideo
    if (!this.local) {
      this.avisoPermisos = 'No se pudo acceder a la cámara ni al micrófono. Puedes entrar igual para ver y escuchar.'
    } else if (!this.tieneVideo || !this.tieneAudio) {
      this.avisoPermisos = !this.tieneVideo ? 'Sin cámara: entrarás solo con audio.' : 'Sin micrófono: te verán pero no te oirán.'
    }
  }

  // Copia del flujo con SOLO el video: así el recuadro propio nunca reproduce tu micrófono.
  private soloVideo(stream: MediaStream): MediaStream {
    return new MediaStream(stream.getVideoTracks())
  }

  alternarMic() {
    if (!this.tieneAudio) return
    this.micActivo = !this.micActivo
    this.local?.getAudioTracks().forEach(t => (t.enabled = this.micActivo))
  }

  // Apagar la cámara la APAGA de verdad (se suelta el dispositivo: se va la luz y el aviso del navegador),
  // y a los demás les llega un video negro mínimo mientras se les avisa para que muestren tu inicial.
  public cambiandoCamara = false
  private negro: MediaStreamTrack | null = null

  /** Video negro de relleno (320×180, 1 imagen por segundo): consume casi nada y mantiene el canal listo para volver a encender. */
  private pistaNegra(): MediaStreamTrack {
    if (this.negro && this.negro.readyState === 'live') return this.negro
    const lienzo = document.createElement('canvas')
    lienzo.width = 320; lienzo.height = 180
    const ctx = lienzo.getContext('2d')
    if (ctx) { ctx.fillStyle = '#18181b'; ctx.fillRect(0, 0, 320, 180) }
    this.negro = lienzo.captureStream(1).getVideoTracks()[0]
    return this.negro
  }

  /** Lo que se envía como video: tu pantalla, tu cámara o el relleno negro si la apagaste. */
  private videoParaEnviar(): MediaStreamTrack | null {
    if (this.compartiendo) return this.pantalla?.getVideoTracks()[0] ?? null
    if (!this.tieneVideo) return null
    return (this.camActivo && this.local?.getVideoTracks()[0]) || this.pistaNegra()
  }

  private anunciarCamara(activa: boolean) {
    for (const p of this.participantes) this.enviar('camara', p.id, { activa })
  }

  async alternarCamara() {
    if (!this.tieneVideo || this.cambiandoCamara) return
    this.cambiandoCamara = true
    try {
      if (this.camActivo) {
        // Apagar: se suelta la cámara
        this.local?.getVideoTracks().forEach(t => { t.stop(); this.local?.removeTrack(t) })
        this.camActivo = false
        this.vistaLocal = this.local ? this.soloVideo(this.local) : null
        if (!this.compartiendo) await this.reemplazarVideo(this.pistaNegra())
        this.anunciarCamara(false)
      } else {
        // Encender: se vuelve a pedir la cámara (HD, y si no da, lo que tenga)
        let pista: MediaStreamTrack | null = null
        for (const video of [{ width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 }, facingMode: 'user' } as MediaTrackConstraints, true as const]) {
          try { pista = (await navigator.mediaDevices.getUserMedia({ video })).getVideoTracks()[0]; if (pista) break } catch { /* prueba la siguiente */ }
        }
        if (!pista) { this.toast.error('No se pudo volver a encender la cámara. Revisa los permisos del navegador.'); return }
        if (!this.local) this.local = new MediaStream()
        this.local.addTrack(pista)
        this.camActivo = true
        this.vistaLocal = this.soloVideo(this.local)
        if (!this.compartiendo) {
          await this.reemplazarVideo(pista)
          for (const p of this.participantes) this.limitarVideo(p.pc)
        }
        this.anunciarCamara(true)
      }
    } finally {
      this.cambiandoCamara = false
    }
  }

  async alternarPantalla() {
    if (this.compartiendo) { this.detenerPantalla(); return }
    if (!navigator.mediaDevices?.getDisplayMedia) { this.toast.info('Tu navegador no permite compartir pantalla'); return }
    try {
      // 15 fps bastan para mostrar documentos y gastan poco ancho de banda; "exclude" evita ofrecer esta misma pestaña (haría un espejo infinito)
      const disp = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include'
      } as any)
      const track = disp.getVideoTracks()[0]
      if (!track) return
      // "detail": el navegador prioriza la nitidez del texto sobre la fluidez
      try { (track as any).contentHint = 'detail' } catch { /* no disponible */ }
      this.pantalla = disp
      this.compartiendo = true
      this.vistaLocal = new MediaStream([track])
      track.onended = () => this.zone.run(() => this.detenerPantalla())
      await this.reemplazarVideo(track)
      this.anunciarPantalla(true)
    } catch { /* el usuario canceló */ }
  }

  private async detenerPantalla() {
    if (!this.compartiendo) return
    this.pantalla?.getTracks().forEach(t => { t.onended = null; t.stop() })
    this.pantalla = null
    this.compartiendo = false
    this.vistaLocal = this.local ? this.soloVideo(this.local) : null
    this.anunciarPantalla(false)
    await this.reemplazarVideo(this.videoParaEnviar())
  }

  // Avisa a los demás para que muestren mi pantalla completa (sin recortar) y más grande
  private anunciarPantalla(activa: boolean) {
    for (const p of this.participantes) this.enviar('pantalla', p.id, { activa })
  }

  /** Hay alguien compartiendo pantalla (otra persona, no yo) */
  get hayPantalla(): boolean { return this.participantes.some(p => p.compartiendo) }

  private async reemplazarVideo(track: MediaStreamTrack | null) {
    for (const p of this.participantes) {
      const sender = p.pc.getTransceivers().find(t => t.receiver.track.kind === 'video')?.sender
      try { await sender?.replaceTrack(track) } catch { /* se ignora */ }
    }
  }


  // ================= Quién está hablando =================
  // Se mide el volumen de cada micrófono (el tuyo y el de los demás); si hay voz, el recuadro se pone verde.
  public yoHablando = false
  private audioCtx: AudioContext | null = null
  private medidores = new Map<string, { fuente: MediaStreamAudioSourceNode; analizador: AnalyserNode; datos: Uint8Array; ultimaVoz: number }>()
  private relojVoz: any = null
  private static readonly UMBRAL_VOZ = 0.03   // volumen mínimo (0 a 1) para considerar que hablan
  private static readonly RETENCION_MS = 450  // sigue verde un instante después de la última sílaba, para que no parpadee

  private medir(clave: string, pista?: MediaStreamTrack | null) {
    this.dejarDeMedir(clave)
    if (!pista || pista.kind !== 'audio') return
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      this.audioCtx ??= new Ctx()
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => { /* se reanuda con el siguiente gesto */ })
      const analizador = this.audioCtx.createAnalyser()
      analizador.fftSize = 512
      analizador.smoothingTimeConstant = 0.3
      const fuente = this.audioCtx.createMediaStreamSource(new MediaStream([pista]))
      fuente.connect(analizador) // sin conectar a la salida: no se oye nada extra
      this.medidores.set(clave, { fuente, analizador, datos: new Uint8Array(analizador.fftSize), ultimaVoz: 0 })
      this.iniciarRelojVoz()
    } catch { /* sin Web Audio: simplemente no se marca quién habla */ }
  }

  private dejarDeMedir(clave: string) {
    const m = this.medidores.get(clave)
    if (!m) return
    try { m.fuente.disconnect() } catch { /* ya estaba suelto */ }
    this.medidores.delete(clave)
  }

  private iniciarRelojVoz() {
    if (this.relojVoz) return
    // Fuera de la zona de Angular: solo se actualiza la pantalla cuando alguien empieza o deja de hablar
    this.zone.runOutsideAngular(() => {
      this.relojVoz = setInterval(() => {
        const ahora = Date.now()
        const cambios: { clave: string; hablando: boolean }[] = []
        this.medidores.forEach((m, clave) => {
          m.analizador.getByteTimeDomainData(m.datos as any)
          let suma = 0
          for (let i = 0; i < m.datos.length; i++) { const v = (m.datos[i] - 128) / 128; suma += v * v }
          if (Math.sqrt(suma / m.datos.length) > SalaComponent.UMBRAL_VOZ) m.ultimaVoz = ahora
          const hablando = ahora - m.ultimaVoz < SalaComponent.RETENCION_MS
          const actual = clave === 'yo' ? this.yoHablando : !!this.buscar(clave)?.hablando
          if (hablando !== actual) cambios.push({ clave, hablando })
        })
        if (cambios.length) {
          this.zone.run(() => cambios.forEach(c => {
            if (c.clave === 'yo') this.yoHablando = c.hablando
            else { const p = this.buscar(c.clave); if (p) p.hablando = c.hablando }
          }))
        }
      }, 120)
    })
  }

  private detenerMedidores() {
    clearInterval(this.relojVoz)
    this.relojVoz = null
    this.medidores.forEach((_m, clave) => this.dejarDeMedir(clave))
    this.audioCtx?.close().catch(() => { /* ya estaba cerrado */ })
    this.audioCtx = null
    this.yoHablando = false
  }

  // ================= Unirse / salir =================
  async unirse() {
    if (!this.nombre.trim()) { this.toast.info('Escribe tu nombre para entrar'); return }
    this.fase = 'llamada'
    this.activo = true
    this.medir('yo', this.local?.getAudioTracks()[0])
    try {
      const resp = await firstValueFrom(this.service.enviarSenal(this.codigo, {
        de: this.yo, tipo: 'join', payload: { nombre: this.nombre.trim() }
      }))
      this.desde = resp.data.id
      this.sondear()
    } catch {
      this.toast.error('No se pudo entrar a la reunión')
      this.cerrarTodo(false)
      this.fase = 'lobby'
      this.iniciarVistaPrevia()
    }
  }

  async salir() {
    try { await firstValueFrom(this.service.enviarSenal(this.codigo, { de: this.yo, tipo: 'leave' })) } catch { /* ya salimos */ }
    this.cerrarTodo(true)
    this.fase = 'fin'
  }

  volverAEntrar() {
    this.yo = this.nuevoId()
    this.fase = 'lobby'
    this.iniciarVistaPrevia()
  }

  private cerrarTodo(soltarMedia: boolean) {
    this.activo = false
    this.participantes.forEach(p => p.pc.close())
    this.participantes = []
    this.pendientes.clear()
    this.detenerMedidores()
    this.pantalla?.getTracks().forEach(t => t.stop())
    this.pantalla = null
    this.compartiendo = false
    if (soltarMedia) {
      this.negro?.stop()
      this.negro = null
      this.local?.getTracks().forEach(t => t.stop())
      this.local = null
      this.vistaLocal = null
    }
  }

  // ================= Señalización (sondeo) =================
  private async sondear() {
    while (this.activo) {
      try {
        const resp = await firstValueFrom(this.service.leerSenales(this.codigo, this.yo, this.desde))
        for (const s of resp.data as Senal[]) {
          try { await this.procesar(s) } catch (e) { console.error('Señal con error', s.tipo, e) }
        }
        this.desde = resp.ultimo
      } catch { /* sin red un momento: se reintenta */ }
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  private enviar(tipo: Senal['tipo'], para: string, payload: any) {
    return firstValueFrom(this.service.enviarSenal(this.codigo, { de: this.yo, para, tipo, payload })).catch(() => null)
  }

  private async procesar(s: Senal) {
    switch (s.tipo) {
      case 'join': {
        // Quien ya estaba en la sala es quien llama a la persona que llega
        if (this.buscar(s.de)) return
        const p = this.crearPeer(s.de, s.payload?.nombre, true)
        const oferta = await p.pc.createOffer()
        await p.pc.setLocalDescription(oferta)
        await this.enviar('offer', s.de, { sdp: p.pc.localDescription, nombre: this.nombre.trim() })
        break
      }
      case 'offer': {
        const p = this.buscar(s.de) ?? this.crearPeer(s.de, s.payload?.nombre, false)
        if (s.payload?.nombre) p.nombre = s.payload.nombre
        await p.pc.setRemoteDescription(s.payload.sdp)
        await this.vaciarPendientes(p)
        const respuesta = await p.pc.createAnswer()
        await p.pc.setLocalDescription(respuesta)
        await this.enviar('answer', s.de, { sdp: p.pc.localDescription })
        break
      }
      case 'answer': {
        const p = this.buscar(s.de)
        if (!p) return
        await p.pc.setRemoteDescription(s.payload.sdp)
        await this.vaciarPendientes(p)
        break
      }
      case 'ice': {
        const p = this.buscar(s.de)
        if (!p || !s.payload) return
        if (p.pc.remoteDescription) {
          await p.pc.addIceCandidate(s.payload)
        } else {
          const cola = this.pendientes.get(s.de) ?? []
          cola.push(s.payload)
          this.pendientes.set(s.de, cola)
        }
        break
      }
      case 'leave':
        this.quitar(s.de)
        break
      case 'camara': {
        const p = this.buscar(s.de)
        if (p) p.camaraApagada = s.payload?.activa === false
        break
      }
      case 'pantalla': {
        const p = this.buscar(s.de)
        if (p) p.compartiendo = !!s.payload?.activa
        break
      }
    }
  }

  private async vaciarPendientes(p: Participante) {
    const cola = this.pendientes.get(p.id) ?? []
    this.pendientes.delete(p.id)
    for (const c of cola) { try { await p.pc.addIceCandidate(c) } catch { /* candidato viejo */ } }
  }

  // ================= Conexiones entre navegadores =================
  private buscar(id: string) {
    return this.participantes.find(p => p.id === id)
  }

  private crearPeer(id: string, nombre: string | undefined, iniciador: boolean): Participante {
    const pc = new RTCPeerConnection(this.rtcConfig)
    const stream = new MediaStream()
    const p: Participante = { id, nombre: nombre || 'Invitado', stream, pc, conectado: false, iniciador, reconectando: false, tieneVideo: false, reintentando: false, compartiendo: false, camaraApagada: false, hablando: false }
    this.participantes = [...this.participantes, p]

    // IMPORTANTE: se usa addTrack (no addTransceiver). Así, cuando llega una oferta,
    // el navegador reutiliza estos canales y nuestro audio y video SÍ se envían en la respuesta.
    const audio = this.local?.getAudioTracks()[0]
    const video = this.videoParaEnviar()
    const flujo = this.local ?? new MediaStream()
    if (audio) pc.addTrack(audio, flujo)
    if (video) pc.addTrack(video, flujo)

    // Quien ofrece deja siempre abiertos canales de audio y video, aunque no tenga cámara o micrófono
    if (iniciador) {
      if (!audio) pc.addTransceiver('audio', { direction: 'sendrecv' })
      if (!video) pc.addTransceiver('video', { direction: 'sendrecv' })
    }

    // Los eventos de la conexión no pasan por la zona de Angular: se envuelven para que la pantalla se actualice.
    pc.addEventListener('track', (e) => this.zone.run(() => {
      if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track)
      if (e.track.kind === 'audio') this.medir(id, e.track)
      if (e.track.kind === 'video') {
        p.tieneVideo = !e.track.muted
        e.track.addEventListener('unmute', () => this.zone.run(() => (p.tieneVideo = true)))
        e.track.addEventListener('mute', () => this.zone.run(() => (p.tieneVideo = false)))
      }
    }))
    pc.addEventListener('icecandidate', (e) => {
      if (e.candidate) this.enviar('ice', id, e.candidate.toJSON())
    })
    pc.addEventListener('connectionstatechange', () => this.zone.run(() => {
      const estado = pc.connectionState
      p.conectado = estado === 'connected'
      p.reconectando = estado === 'disconnected' || estado === 'failed'

      if (estado === 'connected') {
        this.limitarVideo(pc)
        // quien llega cuando ya estoy compartiendo también debe saberlo
        if (this.compartiendo) this.enviar('pantalla', id, { activa: true })
        if (this.tieneVideo && !this.camActivo) this.enviar('camara', id, { activa: false })
      }
      if (estado === 'closed') { this.quitar(id); return }

      // En celulares la conexión se cae y vuelve: se intenta recuperar antes de sacar a la persona.
      if (p.reconectando) {
        setTimeout(() => { if (this.buscar(id) && pc.connectionState !== 'connected') this.reintentarConexion(p) }, estado === 'failed' ? 500 : 4000)
        setTimeout(() => { if (this.buscar(id) && pc.connectionState !== 'connected') this.quitar(id) }, 25000)
      }
    }))
    return p
  }

  /** Reinicia la búsqueda de ruta (ICE) y vuelve a ofrecer. Solo lo hace quien llamó primero, para no chocar. */
  private async reintentarConexion(p: Participante) {
    if (!p.iniciador || p.reintentando) return
    p.reintentando = true
    try {
      const oferta = await p.pc.createOffer({ iceRestart: true })
      await p.pc.setLocalDescription(oferta)
      await this.enviar('offer', p.id, { sdp: p.pc.localDescription, nombre: this.nombre.trim() })
    } catch { /* se intentará de nuevo si sigue caída */ }
    setTimeout(() => (p.reintentando = false), 6000)
  }

  /** Limita el video (~800 kbps) para que el audio no se corte cuando la red es floja. */
  private async limitarVideo(pc: RTCPeerConnection) {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue
      try {
        const parametros = sender.getParameters()
        if (!parametros.encodings?.length) parametros.encodings = [{}]
        // HD 720p con tope de 2.5 Mbps (es un máximo: si la red no da, el navegador baja solo). Con más personas se reparte el ancho de banda: cada una envía a todas
        const otros = Math.max(1, this.participantes.length)
        parametros.encodings[0].maxBitrate = otros === 1 ? 2_500_000 : otros === 2 ? 1_500_000 : 800_000
        await sender.setParameters(parametros)
      } catch { /* el navegador no lo permite: se deja como está */ }
    }
  }

  private quitar(id: string) {
    const p = this.buscar(id)
    if (!p) return
    p.pc.close()
    this.dejarDeMedir(id)
    this.pendientes.delete(id)
    this.participantes = this.participantes.filter(x => x.id !== id)
  }

  // ================= Presentación =================
  gridClase() {
    // Con una pantalla compartida: ella arriba, grande; las personas en una fila pequeña debajo
    if (this.hayPantalla) return 'grid-cols-3 sm:grid-cols-4 grid-rows-[minmax(0,1fr)_7rem]'
    const total = this.participantes.length + 1
    if (total <= 1) return 'auto-rows-fr grid-cols-1'
    if (total === 2) return 'auto-rows-fr grid-cols-1 md:grid-cols-2'
    if (total <= 4) return 'auto-rows-fr grid-cols-1 sm:grid-cols-2'
    return 'auto-rows-fr grid-cols-2 lg:grid-cols-3'
  }

  async copiar() {
    try {
      await navigator.clipboard.writeText(this.enlace)
      this.copiado = true
      this.toast.success('Enlace copiado')
      setTimeout(() => (this.copiado = false), 2500)
    } catch {
      this.toast.error('No se pudo copiar el enlace')
    }
  }

  iniciales(nombre: string) {
    return nombre.split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase()
  }

  private nuevoId() {
    return (crypto as any).randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}
