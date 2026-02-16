import { updateRules, setupOffscreen } from '../src/lib/backgroundLogic';
import * as storage from '../src/lib/storage';
import * as rules from '../src/lib/rules';

// Mock dependencies
jest.mock('../src/lib/storage');
jest.mock('../src/lib/rules');

describe('Background Logic', () => {
  const originalChrome = global.chrome;
  const mockUpdateDynamicRules = jest.fn();
  const mockGetDynamicRules = jest.fn();
  const mockCreateDocument = jest.fn();
  const mockGetContexts = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome = {
      declarativeNetRequest: {
        getDynamicRules: mockGetDynamicRules,
        updateDynamicRules: mockUpdateDynamicRules,
      },
      offscreen: {
        createDocument: mockCreateDocument,
      },
      runtime: {
        getContexts: mockGetContexts,
      },
    };

    // Default mocks
    storage.getStorage.mockResolvedValue({
      lists: { whitelist: [], userKeywords: [] },
    });
    rules.generateRules.mockReturnValue([]);
    mockGetDynamicRules.mockResolvedValue([]);
    mockUpdateDynamicRules.mockResolvedValue();
    mockCreateDocument.mockResolvedValue();
    mockGetContexts.mockResolvedValue([]);
  });

  afterEach(() => {
    global.chrome = originalChrome;
  });

  test('updateRules fetches storage, generates rules, and updates DNR', async () => {
    const mockLists = { whitelist: ['test.com'], userKeywords: ['word'] };
    const mockSettings = { enabledGlobal: true };
    const mockRules = [{ id: 1, action: { type: 'block' } }];
    const existingRules = [{ id: 999 }];

    storage.getStorage.mockResolvedValue({
      lists: mockLists,
      settings: mockSettings,
    });
    rules.generateRules.mockReturnValue(mockRules);
    mockGetDynamicRules.mockResolvedValue(existingRules);

    await updateRules();

    expect(storage.getStorage).toHaveBeenCalled();
    expect(rules.generateRules).toHaveBeenCalledWith(mockLists, mockSettings);
    expect(mockGetDynamicRules).toHaveBeenCalled();
    expect(mockUpdateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [999],
      addRules: mockRules,
    });
  });

  test('handles errors gracefully', async () => {
    storage.getStorage.mockRejectedValue(new Error('Storage failure'));
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await expect(updateRules()).rejects.toThrow('Storage failure');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to update rules:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  describe('Offscreen Management', () => {
    test('setupOffscreen creates document if none exists', async () => {
      mockGetContexts.mockResolvedValue([]);
      await setupOffscreen();
      expect(mockGetContexts).toHaveBeenCalledWith({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
      });
      expect(mockCreateDocument).toHaveBeenCalled();
    });

    test('setupOffscreen does not create document if one already exists', async () => {
      mockGetContexts.mockResolvedValue([
        { contextType: 'OFFSCREEN_DOCUMENT' },
      ]);
      await setupOffscreen();
      expect(mockCreateDocument).not.toHaveBeenCalled();
    });
  });
});
