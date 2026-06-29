// netlify/functions/ask-claude.js
// This runs on Netlify's servers — your API key never reaches the browser.

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Make sure the API key is set
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY environment variable is not set." }),
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: event.body, // pass the request body straight through
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers:    { "Content-Type": "application/json" },
      body:       JSON.stringify(data),
    };
  } catch (err) {
    console.error("Claude API error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to reach Claude API. Please try again." }),
    };
  }
};
