import { TestBed } from '@angular/core/testing';

import { ServiceadminService } from './serviceadmin.service';

describe('ServiceadminService', () => {
  let service: ServiceadminService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServiceadminService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
