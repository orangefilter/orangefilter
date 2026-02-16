import { getStorage, setStorage, defaults } from '../src/lib/storage';

describe('Storage', () => {
  const originalChrome = global.chrome;

  beforeEach(() => {
    global.chrome = {
      runtime: { lastError: null },
      storage: {
        local: {
          get: jest.fn((key, cb) => cb({})),
          set: jest.fn((data, cb) => cb()),
        },
      },
    };
  });

  afterEach(() => {
    global.chrome = originalChrome;
  });

  test('returns defaults when empty', async () => {
    const data = await getStorage();
    expect(data).toEqual(defaults);
  });

  test('merges stored data with defaults', async () => {
    const stored = {
      settings: { enabledGlobal: false },
    };
    global.chrome.storage.local.get.mockImplementation((key, cb) => cb(stored));

    const data = await getStorage();
    expect(data.settings.enabledGlobal).toBe(false);
    expect(data.settings.sensitivity).toBe(defaults.settings.sensitivity);
  });

  test('setStorage calls chrome.storage.local.set', async () => {
    const newData = { settings: { enabledGlobal: false } };
    await setStorage(newData);
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
      newData,
      expect.any(Function)
    );
  });
});
