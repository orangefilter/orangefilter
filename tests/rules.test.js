import { generateRules } from '../src/lib/rules';

describe('Rule Generator', () => {
  test('returns empty array for empty input', () => {
    const rules = generateRules({ whitelist: [], userKeywords: [] });
    expect(rules).toEqual([]);
  });

  test('generates allow rules for whitelist', () => {
    const rules = generateRules({
      whitelist: ['example.com'],
      userKeywords: [],
    });
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      priority: 100,
      action: { type: 'allow' },
      condition: {
        urlFilter: '||example.com^',
        resourceTypes: ['main_frame'],
      },
    });
  });

  test('generates block rules for keywords', () => {
    const rules = generateRules({ whitelist: [], userKeywords: ['orange'] });
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      priority: 10,
      action: { type: 'block' },
      condition: {
        urlFilter: '*orange*',
        resourceTypes: ['main_frame'],
        isUrlFilterCaseSensitive: false,
      },
    });
  });

  test('handles mixed lists with correct ids', () => {
    const lists = {
      whitelist: ['good.com'],
      userKeywords: ['bad'],
    };
    const rules = generateRules(lists);
    expect(rules).toHaveLength(2);

    // Allow rule first (by implementation order)
    expect(rules[0].action.type).toBe('allow');
    expect(rules[0].id).toBe(1);

    // Block rule second
    expect(rules[1].action.type).toBe('block');
    expect(rules[1].id).toBe(2);
  });
});
