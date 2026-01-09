#!/usr/bin/env ts-node
import { filterCategoryTags } from './src/utils/tagUtils';

// Test cases
const testCases = [
  { input: ['GAMING'], expected: [] },
  { input: ['casino', 'gambling', 'slots'], expected: ['casino', 'gambling', 'slots'] },
  { input: ['GAMING', 'casino', 'poker'], expected: ['casino', 'poker'] },
  { input: ['Grand Theft Auto V (GTA)', 'Just Chatting'], expected: ['Grand Theft Auto V (GTA)', 'Just Chatting'] },
  { input: ['_CAT_GAMING', 'poker'], expected: ['poker'] },
];

console.log('Testing filterCategoryTags:\n');

testCases.forEach((test, i) => {
  const result = filterCategoryTags(test.input);
  const passed = JSON.stringify(result) === JSON.stringify(test.expected);
  console.log(`Test ${i + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Input:    [${test.input.join(', ')}]`);
  console.log(`  Expected: [${test.expected.join(', ')}]`);
  console.log(`  Got:      [${result.join(', ')}]`);
  console.log('');
});
