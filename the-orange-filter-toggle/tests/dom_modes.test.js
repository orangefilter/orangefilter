/**
 * @jest-environment jsdom
 */
import { scanAndFilter } from '../src/lib/dom';

describe('DOM Filtering Modes', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('scanAndFilter hides text containers in default mode', () => {
    document.body.innerHTML = `
      <article id="match">Orange wins something</article>
      <div class="card" id="no-match">Sky is blue</div>
    `;

    scanAndFilter(['orange'], { sensitivity: 'balanced' });

    expect(document.getElementById('match').style.display).toBe('none');
    expect(document.getElementById('no-match').style.display).not.toBe('none');
  });

  test('scanAndFilter DOES NOT hide text containers in "pictures-only" mode', () => {
    document.body.innerHTML = `
      <article id="match">Orange wins something</article>
      <div class="card" id="no-match">Sky is blue</div>
    `;

    scanAndFilter(['orange'], { sensitivity: 'pictures-only' });

    // Text container should NOT be hidden
    expect(document.getElementById('match').style.display).not.toBe('none');
    expect(document.getElementById('no-match').style.display).not.toBe('none');
  });

  test('scanAndFilter STILL hides images in "pictures-only" mode', () => {
    document.body.innerHTML = `
      <img id="bad-img" alt="The Orange in Florida" src="orange.jpg">
      <img id="good-img" alt="A cute cat" src="cat.jpg">
    `;

    scanAndFilter(['orange'], { sensitivity: 'pictures-only' });

    // Image should still be hidden
    expect(document.getElementById('bad-img').style.display).toBe('none');
    expect(document.getElementById('good-img').style.display).not.toBe('none');
  });
});
