import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getTrustedClientIp } from './request-client-ip'

describe('getTrustedClientIp', () => {
  beforeEach(() => {
    delete process.env.PIS_TRUST_PROXY_HEADERS
    delete process.env.TRUST_PROXY_HEADERS
  })

  afterEach(() => {
    delete process.env.PIS_TRUST_PROXY_HEADERS
    delete process.env.TRUST_PROXY_HEADERS
  })

  it('returns unknown when trust is off even if x-forwarded-for is set', () => {
    const req = new NextRequest('http://localhost/', {
      headers: { 'x-forwarded-for': '203.0.113.1' },
    })
    expect(getTrustedClientIp(req)).toBe('unknown')
  })

  it('uses cf-connecting-ip when trust is on', () => {
    process.env.PIS_TRUST_PROXY_HEADERS = 'true'
    const req = new NextRequest('http://localhost/', {
      headers: {
        'cf-connecting-ip': '198.51.100.2',
        'x-forwarded-for': '203.0.113.1',
      },
    })
    expect(getTrustedClientIp(req)).toBe('198.51.100.2')
  })

  it('uses first x-forwarded-for when trust is on and no cf header', () => {
    process.env.TRUST_PROXY_HEADERS = 'true'
    const req = new NextRequest('http://localhost/', {
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
    })
    expect(getTrustedClientIp(req)).toBe('203.0.113.1')
  })
})
