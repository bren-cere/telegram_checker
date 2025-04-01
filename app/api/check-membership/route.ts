import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Create a new response
  const response = NextResponse.json({});
  
  // Add CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const channelId = searchParams.get("channelId")

    // Validate parameters
    if (!userId || !channelId) {
      return NextResponse.json({ error: "Missing required parameters: userId and channelId" }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
    }

    // Get bot token from environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: "Bot token not configured" }, { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
    }

    try {
      // Check if user is a member of the channel
      const isMember = await checkMembership(botToken, userId, channelId)
      
      return NextResponse.json({
        userId,
        channelId,
        isMember,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
    } catch (error: any) {
      return NextResponse.json({ 
        error: error.message
      }, { 
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
  } catch (error: any) {
    console.error("Error checking membership:", error)
    return NextResponse.json({ error: error.message || "Failed to check membership" }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  }
}


async function checkMembership(botToken: string, userId: string, channelId: string): Promise<boolean> {
  try {
    // Ensure userId is numeric and valid
    if (!/^\d+$/.test(userId)) {
      throw new Error("Invalid user ID format. User ID must be numeric.");
    }

    // Format channel ID correctly - ensure channelId is a string
    let formattedChannelId = String(channelId);
    if (!formattedChannelId.startsWith('@') && !formattedChannelId.startsWith('-') && !/^\d+$/.test(formattedChannelId)) {
      formattedChannelId = `@${formattedChannelId}`;
    }
    
    // First, check if the bot can access the chat
    const getChatUrl = `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(formattedChannelId)}`;
    const chatResponse = await fetch(getChatUrl);
    const chatData = await chatResponse.json();
    
    if (!chatData.ok) {
      throw new Error(`Cannot access chat: ${chatData.description}`);
    }
    
    // Now try to get chat member
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(formattedChannelId)}&user_id=${userId}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.ok) {
      // Special handling for common errors
      if (data.description.includes("PARTICIPANT_ID_INVALID")) {
        return false; // Consider the user not a member if we can't verify
      }
      
      throw new Error(`Telegram API error: ${data.description}`);
    }
    
    // Check if user is a member based on status
    const status = data.result.status;
    return ['creator', 'administrator', 'member', 'restricted'].includes(status);
  } catch (error) {
    console.error('Error in checkMembership:', error);
    throw error;
  }
}
