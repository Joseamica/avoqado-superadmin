import { describe, it, expect, beforeEach, vi } from 'vitest'

interface MockSocket {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
  connected: boolean
}

const ioMock = vi.fn<(url: string, opts: unknown) => MockSocket>()

vi.mock('socket.io-client', () => ({
  io: (...args: [string, unknown]) => ioMock(...args),
}))

function createMockSocket(): MockSocket {
  return {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(),
    connected: true,
  }
}

beforeEach(async () => {
  ioMock.mockReset()
  vi.resetModules()
})

describe('connectSocket', () => {
  it('lazily creates a socket on first call and reuses it on second', async () => {
    const mock = createMockSocket()
    ioMock.mockReturnValue(mock)

    const { connectSocket } = await import('./socket')
    const first = connectSocket()
    expect(ioMock).toHaveBeenCalledTimes(1)
    expect(first).toBe(mock)

    // Second call returns the same (already-connected) socket
    const second = connectSocket()
    expect(ioMock).toHaveBeenCalledTimes(1)
    expect(second).toBe(mock)
  })

  it('reconnects an existing-but-disconnected socket without re-creating it', async () => {
    const mock = createMockSocket()
    ioMock.mockReturnValue(mock)

    const { connectSocket } = await import('./socket')
    connectSocket()
    mock.connected = false

    connectSocket()
    expect(mock.connect).toHaveBeenCalledTimes(1)
    expect(ioMock).toHaveBeenCalledTimes(1)
  })

  it('passes withCredentials, reconnection options, and transports to io()', async () => {
    const mock = createMockSocket()
    ioMock.mockReturnValue(mock)

    const { connectSocket } = await import('./socket')
    connectSocket()
    const [, opts] = ioMock.mock.calls[0]
    expect(opts).toMatchObject({
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
    })
    expect((opts as { transports: string[] }).transports).toEqual(['websocket', 'polling'])
  })

  it('strips the /api/vN path suffix from VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api/v1')
    const mock = createMockSocket()
    ioMock.mockReturnValue(mock)

    const { connectSocket } = await import('./socket')
    connectSocket()
    expect(ioMock.mock.calls[0][0]).toBe('https://api.example.com')
    vi.unstubAllEnvs()
  })

  it('falls back to localhost:3000 when VITE_API_URL is empty', async () => {
    vi.stubEnv('VITE_API_URL', '')
    const mock = createMockSocket()
    ioMock.mockReturnValue(mock)

    const { connectSocket } = await import('./socket')
    connectSocket()
    expect(ioMock.mock.calls[0][0]).toBe('http://localhost:3000')
    vi.unstubAllEnvs()
  })
})

describe('disconnectSocket', () => {
  it('no-ops when no socket has been created yet', async () => {
    const { disconnectSocket, getSocket } = await import('./socket')
    expect(() => disconnectSocket()).not.toThrow()
    expect(getSocket()).toBeNull()
  })

  it('removes listeners and disconnects when a socket exists', async () => {
    const mock = createMockSocket()
    ioMock.mockReturnValue(mock)

    const { connectSocket, disconnectSocket, getSocket } = await import('./socket')
    connectSocket()
    expect(getSocket()).toBe(mock)

    disconnectSocket()
    expect(mock.removeAllListeners).toHaveBeenCalled()
    expect(mock.disconnect).toHaveBeenCalled()
    expect(getSocket()).toBeNull()
  })
})

describe('getSocket', () => {
  it('returns null before connectSocket has been called', async () => {
    const { getSocket } = await import('./socket')
    expect(getSocket()).toBeNull()
  })
})
