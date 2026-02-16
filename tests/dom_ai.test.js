/**
 * @jest-environment jsdom
 */
import { scanAndFilter } from '../src/lib/dom';

// Mock chrome.runtime
const sendMessageMock = jest.fn();
global.chrome = {
  runtime: {
    sendMessage: sendMessageMock,
  },
};

// Mock fetch
global.fetch = jest.fn();

describe('DOM AI Scanning', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  test('scanImagesAI fetches image and sends base64 to background', async () => {
    // Setup DOM with an image that doesn't match keywords but should be scanned
    document.body.innerHTML = `
      <img id="test-img" src="https://example.com/photo.jpg" width="100" height="100">
    `;

    // Mock successful fetch returning a blob
    const mockBlob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
    global.fetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    // Mock FileReader (jsdom supports it but we need to ensure readAsDataURL works as we expect or just rely on jsdom)
    // Actually, JSDOM FileReader might not produce the exact base64 string from a fake blob easily without real encoding,
    // but we can trust JSDOM's FileReader implementation generally.
    // However, if JSDOM's FileReader is too basic, we might need to mock it.
    // Let's try without mocking FileReader first, relying on JSDOM.

    // Settings to trigger AI
    const settings = {
      aiMode: 'balanced',
      aiConsent: true,
      sensitivity: 'balanced',
    };

    // Run scan
    // Run scan with a dummy keyword to bypass the early return check
    await scanAndFilter(['nomatch'], settings);

    // Wait for async operations (microtasks)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/photo.jpg');

    // Verify sendMessage was called with base64
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'background',
        type: 'CHECK_IMAGE',
        data: expect.objectContaining({
          url: 'https://example.com/photo.jpg',
          type: 'base64',
          data: expect.stringContaining('data:image/jpeg;base64,'),
        }),
      })
    );
  });

  test('scanImagesAI handles fetch failure by sending URL only', async () => {
    // Setup DOM
    document.body.innerHTML = `
       <img id="test-img-fail" src="https://example.com/fail.jpg" width="100" height="100">
     `;

    // Mock failed fetch
    global.fetch.mockResolvedValue({
      ok: false,
    });

    const settings = {
      aiMode: 'balanced',
      aiConsent: true,
      sensitivity: 'balanced',
    };

    // Run scan with a dummy keyword to bypass the early return check
    await scanAndFilter(['nomatch'], settings);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should still send message but without base64?
    // Actually my code sends payload with URL regardless, but base64 is optional.
    // If base64Data is null, it's not added.

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'background',
        type: 'CHECK_IMAGE',
        data: expect.objectContaining({
          url: 'https://example.com/fail.jpg',
        }),
      })
    );

    // Ensure base64 is NOT present in the call arguments
    const callArgs = sendMessageMock.mock.calls[0][0];
    expect(callArgs.data.base64).toBeUndefined();
  });

  test('scanImagesAI blurs image in grey zone (0.65 < confidence < 0.85)', async () => {
    document.body.innerHTML = `
      <img id="grey-img" src="https://example.com/grey.jpg" width="100" height="100">
    `;

    global.fetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['data'])),
    });

    // Mock AI response in grey zone
    sendMessageMock.mockResolvedValue({
      success: true,
      isBlocked: false,
      confidence: 0.75,
      layer: 'mobilenet',
    });

    const settings = {
      aiMode: 'balanced',
      aiConsent: true,
      sensitivity: 'balanced',
    };

    await scanAndFilter(['nomatch'], settings);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const img = document.getElementById('grey-img');
    expect(img.style.filter).toBe('blur(20px)');
    expect(img.dataset.orangeFilterHidden).toBe('true');
  });
});
