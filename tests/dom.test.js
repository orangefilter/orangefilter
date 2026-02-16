/**
 * @jest-environment jsdom
 */
import { containsKeywords, scanAndFilter, blurElement } from '../src/lib/dom';

describe('DOM Filtering', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('containsKeywords detects keywords in element text', () => {
    const div = document.createElement('div');
    div.innerText = 'This is a story about Donald Trump.';
    expect(containsKeywords(div, ['trump'])).toBe(true);
    expect(containsKeywords(div, ['biden'])).toBe(false);
  });

  test('scanAndFilter hides matching elements', () => {
    document.body.innerHTML = `
      <article id="match">Trump wins something</article>
      <div class="card" id="no-match">Sky is blue</div>
      <div class="teaser" id="match-2">Breaking news: Trump rally</div>
    `;

    scanAndFilter(['trump']);

    expect(document.getElementById('match').style.display).toBe('none');
    expect(document.getElementById('match').dataset.orangeFilterHidden).toBe(
      'true'
    );
    expect(document.getElementById('no-match').style.display).not.toBe('none');
    expect(document.getElementById('match-2').style.display).toBe('none');
  });

  test('scanAndFilter ignores already hidden elements', () => {
    document.body.innerHTML = '<article id="item">Trump</article>';
    const el = document.getElementById('item');
    el.dataset.orangeFilterHidden = 'true';
    el.style.display = 'block';

    scanAndFilter(['trump']);

    // Should still be block because it was skipped
    expect(el.style.display).toBe('block');
  });

  test('scanAndFilter hides images based on alt text', () => {
    document.body.innerHTML = `
      <img id="bad-img" alt="Donald Trump in Florida" src="orange.jpg">
      <img id="good-img" alt="A cute cat" src="cat.jpg">
    `;

    scanAndFilter(['trump']);

    expect(document.getElementById('bad-img').style.display).toBe('none');
    expect(document.getElementById('good-img').style.display).not.toBe('none');
  });

  test('scanAndFilter hides images based on parent link text', () => {
    // We use a container that is NOT in DEFAULT_SELECTORS to ensure the image itself is what gets hidden
    document.body.innerHTML = `
      <section id="non-matching-container">
        <a href="/news" id="bad-link">
          <img id="context-img" src="photo.jpg">
          <span>Latest Trump News</span>
        </a>
      </section>
    `;

    scanAndFilter(['trump']);

    expect(document.getElementById('context-img').style.display).toBe('none');
  });

  test('scanAndFilter creates a placeholder for hidden images', () => {
    document.body.innerHTML =
      '<img id="img" alt="Trump" src="t.jpg" width="200" height="100">';

    scanAndFilter(['trump']);

    const placeholder = document.querySelector('.orange-filter-placeholder');
    expect(placeholder).not.toBeNull();
    expect(placeholder.textContent).toBe(
      'Filtered Content (Click to show)Report False Positive'
    );
  });

  test('clicking placeholder reveals the image', () => {
    document.body.innerHTML =
      '<img id="img" alt="Trump" src="t.jpg" width="200" height="100">';
    const img = document.getElementById('img');

    scanAndFilter(['trump']);

    const placeholder = document.querySelector('.orange-filter-placeholder');
    expect(img.style.display).toBe('none');

    placeholder.click();

    expect(img.style.display).toBe('');
    expect(img.dataset.orangeFilterHidden).toBe('false');
    expect(img.dataset.orangeFilterRevealed).toBe('true');
    expect(document.querySelector('.orange-filter-placeholder')).toBeNull();
  });

  test('blurElement applies blur and reveals on click', () => {
    document.body.innerHTML = '<img id="img" src="t.jpg">';
    const img = document.getElementById('img');

    blurElement(img, 'test reason');

    expect(img.style.filter).toBe('blur(20px)');
    expect(img.dataset.orangeFilterHidden).toBe('true');

    img.click();

    expect(img.style.filter).toBe('');
    expect(img.dataset.orangeFilterHidden).toBe('false');
    expect(img.dataset.orangeFilterRevealed).toBe('true');
  });
});
