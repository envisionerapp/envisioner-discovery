import { chatService } from '../src/services/chatService';

async function test() {
  try {
    console.log('\n🧪 Testing chat with betting query...\n');

    const result = await chatService.processMessage(
      'test-user-123',
      'give me streamers for betting',
      'test-conversation'
    );

    console.log('Response:', result.response);
    console.log('Streamers returned:', result.streamers?.length || 0);

    if (result.streamers && result.streamers.length > 0) {
      console.log('\n✅ SUCCESS! Returned streamers:');
      result.streamers.slice(0, 5).forEach((s: any) => {
        console.log(`  - ${s.displayName || s.username} (@${s.username}) - ${s.platform} - Tags: ${s.tags?.join(', ')}`);
      });
    } else {
      console.log('\n❌ FAILED: No streamers returned');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

test();
