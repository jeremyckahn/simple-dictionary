import { describe, expect, it } from 'vitest'
import { formatBytes, isMeteredConnection, shouldSuggestInstall } from './env.ts'

describe('isMeteredConnection', () => {
  it('is false without connection info or on fast connections', () => {
    expect(isMeteredConnection(undefined)).toBe(false)
    expect(isMeteredConnection({ effectiveType: '4g' })).toBe(false)
  })

  it('detects Save-Data, cellular and slow connections', () => {
    expect(isMeteredConnection({ saveData: true })).toBe(true)
    expect(isMeteredConnection({ type: 'cellular' })).toBe(true)
    expect(isMeteredConnection({ effectiveType: '3g' })).toBe(true)
    expect(isMeteredConnection({ effectiveType: 'slow-2g' })).toBe(true)
  })
})

describe('shouldSuggestInstall', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'

  it('suggests installing on iOS in the browser', () => {
    expect(shouldSuggestInstall(iphone, 5, false)).toBe(true)
  })

  it('treats touch-enabled "Macintosh" as iPadOS, but not a real Mac', () => {
    expect(shouldSuggestInstall(mac, 5, false)).toBe(true)
    expect(shouldSuggestInstall(mac, 0, false)).toBe(false)
  })

  it('does not suggest once installed or on other platforms', () => {
    expect(shouldSuggestInstall(iphone, 5, true)).toBe(false)
    expect(shouldSuggestInstall('Mozilla/5.0 (Linux; Android 14)', 5, false)).toBe(false)
  })
})

describe('formatBytes', () => {
  it('formats KB and MB', () => {
    expect(formatBytes(10)).toBe('1 KB')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(8_725_231)).toBe('8.3 MB')
  })
})
