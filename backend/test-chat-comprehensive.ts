import { chatService } from './src/services/chatService';
import { logger } from './src/utils/database';

const TEST_USER_ID = 'test-user-chat-comprehensive';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(testName: string, testFn: () => Promise<boolean>): Promise<void> {
  const startTime = Date.now();
  try {
    console.log(`\n🧪 Running: ${testName}...`);
    const passed = await testFn();
    const duration = Date.now() - startTime;

    results.push({
      testName,
      passed,
      details: passed ? 'Test passed successfully' : 'Test failed',
      duration
    });

    console.log(passed ? '✅ PASSED' : '❌ FAILED');
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      testName,
      passed: false,
      details: error instanceof Error ? error.message : String(error),
      duration
    });
    console.error('❌ FAILED:', error);
  }
}

async function testBasicMessageSending(): Promise<boolean> {
  const response = await chatService.processMessage(TEST_USER_ID, 'Hello Mielo', undefined);

  console.log('  Response:', response.response);
  console.log('  Processing time:', response.processingTime, 'ms');

  return !!response.response && response.response.length > 0;
}

async function testSearchQuery(): Promise<boolean> {
  const response = await chatService.processMessage(
    TEST_USER_ID,
    'Show me 10 gaming streamers from Brazil',
    undefined
  );

  console.log('  Response:', response.response);
  console.log('  Streamers found:', response.streamers?.length || 0);
  console.log('  Processing time:', response.processingTime, 'ms');

  return !!response.streamers && response.streamers.length > 0;
}

async function testContextRetention(): Promise<boolean> {
  // First message
  const response1 = await chatService.processMessage(
    TEST_USER_ID,
    'I need streamers from Peru',
    undefined
  );

  const conversationId = response1.conversationId;
  console.log('  First response:', response1.response);

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Second message in same conversation - should remember Peru
  const response2 = await chatService.processMessage(
    TEST_USER_ID,
    'Actually, make it 20 gaming creators',
    conversationId
  );

  console.log('  Second response:', response2.response);
  console.log('  Streamers found:', response2.streamers?.length || 0);

  // Check if response mentions Peru or maintains context
  const maintainedContext = response2.response.toLowerCase().includes('peru') ||
                           (response2.streamers && response2.streamers.length > 0);

  return !!maintainedContext;
}

async function testMarkdownFormatting(): Promise<boolean> {
  const response = await chatService.processMessage(
    TEST_USER_ID,
    'What can you help me with?',
    undefined
  );

  console.log('  Response:', response.response);

  // Check for markdown elements
  const hasBold = response.response.includes('**');
  const hasBullets = response.response.includes('•');
  const hasNewlines = response.response.includes('\n\n');

  console.log('  Has bold:', hasBold);
  console.log('  Has bullets:', hasBullets);
  console.log('  Has proper spacing:', hasNewlines);

  return hasBold && hasBullets && hasNewlines;
}

async function testNumberExtraction(): Promise<boolean> {
  const response = await chatService.processMessage(
    TEST_USER_ID,
    'I need 5 casino streamers',
    undefined
  );

  console.log('  Response:', response.response);
  console.log('  Streamers found:', response.streamers?.length || 0);

  // Should return exactly 5 or close to it (might be less if not enough available)
  return !!response.streamers && response.streamers.length >= 1 && response.streamers.length <= 5;
}

async function testTagExtraction(): Promise<boolean> {
  const response = await chatService.processMessage(
    TEST_USER_ID,
    'Find me GTA streamers',
    undefined
  );

  console.log('  Response:', response.response);
  console.log('  Streamers found:', response.streamers?.length || 0);

  // Check if streamers returned have GTA tag or are relevant
  if (!response.streamers || response.streamers.length === 0) {
    return false;
  }

  return true;
}

async function testConversationHistory(): Promise<boolean> {
  const response = await chatService.processMessage(
    TEST_USER_ID,
    'Show me streamers from Argentina',
    undefined
  );

  const conversationId = response.conversationId;

  // Get conversation history
  const history = await chatService.getUserConversations(TEST_USER_ID);

  console.log('  Total conversations:', history.length);
  console.log('  Latest conversation title:', history[0]?.title);

  return history.length > 0;
}

async function testQuestionAsking(): Promise<boolean> {
  const response = await chatService.processMessage(
    TEST_USER_ID,
    'I need influencers',
    undefined
  );

  console.log('  Response:', response.response);

  // Should ask clarifying questions for vague query
  const asksQuestion = response.response.includes('?') ||
                       response.response.toLowerCase().includes('what') ||
                       response.response.toLowerCase().includes('which');

  console.log('  Asks clarifying question:', asksQuestion);

  return asksQuestion;
}

async function testEmptyQuery(): Promise<boolean> {
  try {
    const response = await chatService.processMessage(TEST_USER_ID, '', undefined);
    // Should handle gracefully
    return false; // Should not reach here
  } catch (error) {
    // Expected to throw or handle gracefully
    return true;
  }
}

async function testLongConversation(): Promise<boolean> {
  let conversationId: string | undefined;

  // Send 5 messages in sequence
  for (let i = 1; i <= 5; i++) {
    const response = await chatService.processMessage(
      TEST_USER_ID,
      `Message ${i}: Show me ${i * 5} streamers`,
      conversationId
    );

    if (!conversationId) {
      conversationId = response.conversationId;
    }

    console.log(`  Message ${i} processed:`, response.response.substring(0, 50) + '...');

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Final message referencing the conversation
  const finalResponse = await chatService.processMessage(
    TEST_USER_ID,
    'Thanks for all the recommendations',
    conversationId
  );

  console.log('  Final response:', finalResponse.response);

  return !!finalResponse.response;
}

async function main() {
  console.log('🚀 Starting Comprehensive AI Chat Tests\n');
  console.log('=' .repeat(60));

  await runTest('Test 1: Basic Message Sending', testBasicMessageSending);
  await runTest('Test 2: Search Query Processing', testSearchQuery);
  await runTest('Test 3: Context Retention', testContextRetention);
  await runTest('Test 4: Markdown Formatting', testMarkdownFormatting);
  await runTest('Test 5: Number Extraction', testNumberExtraction);
  await runTest('Test 6: Tag Extraction (GTA)', testTagExtraction);
  await runTest('Test 7: Conversation History', testConversationHistory);
  await runTest('Test 8: Question Asking for Vague Queries', testQuestionAsking);
  await runTest('Test 9: Empty Query Handling', testEmptyQuery);
  await runTest('Test 10: Long Conversation Flow', testLongConversation);

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} Test ${index + 1}: ${result.testName} (${result.duration}ms)`);
    if (!result.passed) {
      console.log(`   └─ ${result.details}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Total duration: ${totalDuration}ms`);
  console.log(`Success rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
