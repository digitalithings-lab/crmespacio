import { Component, HostListener, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ServiceclientesService } from 'src/app/services/serviceclientes.service';
import { Senal, ServicesalaService } from 'src/app/services/servicesala.service';
import { ToastService } from 'src/app/services/toast.service';

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
}

type Fase = 'cargando' | 'noexiste' | 'lobby' | 'llamada' | 'fin'

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
  public esAdmin = !!localStorage.getItem('correo')
  public idexpediente: string | null = null

  private yo = this.nuevoId()
  private desde = 0
  private activo = false
  private pantalla: MediaStream | null = null
  private pendientes = new Map<string, RTCIceCandidateInit[]>()

  // Audio claro: cancelación de eco, reducción de ruido y volumen automático
  private audioConstraints: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }

  // Sin servidor TURN: funciona en la mayoría de redes, pero no en las más restrictivas.
  private rtcConfig: RTCConfiguration = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  }

  constructor(
    private route: ActivatedRoute,
    private service: ServicesalaService,
    private clientes: ServiceclientesService,
    private toast: ToastService,
    private zone: NgZone
  ) { }

  ngOnInit(): void {
    this.codigo = (this.route.snapshot.paramMap.get('codigo') ?? '').toLowerCase()
    const n = localStorage.getItem('nombre')
    const a = localStorage.getItem('apellido')
    this.nombre = [n, a].filter(Boolean).join(' ')

    this.service.obtenerSala(this.codigo).subscribe({
      next: (resp) => {
        this.nombreSala = resp.data?.nombre ?? ''
        this.idexpediente = resp.data?.idexpediente ?? null
        // La nota flotante deja seleccionado al cliente de esta reunión
        if (this.esAdmin && this.idexpediente) this.clientes.clienteContexto.next(this.idexpediente)
        this.fase = 'lobby'
        this.iniciarVistaPrevia()
      },
      error: () => { this.fase = 'noexiste' }
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

  alternarCamara() {
    if (!this.tieneVideo) return
    this.camActivo = !this.camActivo
    this.local?.getVideoTracks().forEach(t => (t.enabled = this.camActivo))
  }

  async alternarPantalla() {
    if (this.compartiendo) { this.detenerPantalla(); return }
    try {
      const disp = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const track = disp.getVideoTracks()[0]
      this.pantalla = disp
      this.compartiendo = true
      this.vistaLocal = new MediaStream([track])
      await this.reemplazarVideo(track)
      track.onended = () => this.detenerPantalla()
    } catch { /* el usuario canceló */ }
  }

  private async detenerPantalla() {
    this.pantalla?.getTracks().forEach(t => t.stop())
    this.pantalla = null
    this.compartiendo = false
    this.vistaLocal = this.local ? this.soloVideo(this.local) : null
    await this.reemplazarVideo(this.local?.getVideoTracks()[0] ?? null)
  }

  private async reemplazarVideo(track: MediaStreamTrack | null) {
    for (const p of this.participantes) {
      const sender = p.pc.getTransceivers().find(t => t.receiver.track.kind === 'video')?.sender
      try { await sender?.replaceTrack(track) } catch { /* se ignora */ }
    }
  }

  // ================= Unirse / salir =================
  async unirse() {
    if (!this.nombre.trim()) { this.toast.info('Escribe tu nombre para entrar'); return }
    this.fase = 'llamada'
    this.activo = true
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
    this.pantalla?.getTracks().forEach(t => t.stop())
    this.pantalla = null
    this.compartiendo = false
    if (soltarMedia) {
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
    const p: Participante = { id, nombre: nombre || 'Invitado', stream, pc, conectado: false, iniciador, reconectando: false, tieneVideo: false, reintentando: false }
    this.participantes = [...this.participantes, p]

    // IMPORTANTE: se usa addTrack (no addTransceiver). Así, cuando llega una oferta,
    // el navegador reutiliza estos canales y nuestro audio y video SÍ se envían en la respuesta.
    const audio = this.local?.getAudioTracks()[0]
    const video = this.compartiendo ? this.pantalla?.getVideoTracks()[0] : this.local?.getVideoTracks()[0]
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

      if (estado === 'connected') this.limitarVideo(pc)
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
        parametros.encodings[0].maxBitrate = 800_000
        await sender.setParameters(parametros)
      } catch { /* el navegador no lo permite: se deja como está */ }
    }
  }

  private quitar(id: string) {
    const p = this.buscar(id)
    if (!p) return
    p.pc.close()
    this.pendientes.delete(id)
    this.participantes = this.participantes.filter(x => x.id !== id)
  }

  // ================= Presentación =================
  gridClase() {
    const total = this.participantes.length + 1
    if (total <= 1) return 'grid-cols-1'
    if (total === 2) return 'grid-cols-1 md:grid-cols-2'
    if (total <= 4) return 'grid-cols-1 sm:grid-cols-2'
    return 'grid-cols-2 lg:grid-cols-3'
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
