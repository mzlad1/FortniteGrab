// backend/src/server.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Epic Games Tokens (from environment variables)
const SWITCH_TOKEN =
  process.env.SWITCH_TOKEN ||
  "OThmN2U0MmMyZTNhNGY4NmE3NGViNDNmYmI0MWVkMzk6MGEyNDQ5YTItMDAxYS00NTFlLWFmZWMtM2U4MTI5MDFjNGQ3";
const IOS_TOKEN =
  process.env.IOS_TOKEN ||
  "M2Y2OWU1NmM3NjQ5NDkyYzhjYzI5ZjFhZjA4YThhMTI6YjUxZWU5Y2IxMjIzNGY1MGE2OWVmYTY3ZWY1MzgxMmU=";

// Helper: Get client credentials token
async function getClientToken() {
  try {
    const response = await axios.post(
      "https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token",
      "grant_type=client_credentials",
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `basic ${SWITCH_TOKEN}`,
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Client token error:", error.response?.data || error.message);
    throw new Error("Failed to get client token");
  }
}

// Helper: Authenticate with device auth (WORKING METHOD)
async function authenticateWithDeviceAuth(deviceId, accountId, secret) {
  try {
    const response = await axios.post(
      "https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token",
      `grant_type=device_auth&device_id=${deviceId}&account_id=${accountId}&secret=${secret}`,
      {
        headers: {
          Authorization: `basic ${IOS_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return {
      success: true,
      access_token: response.data.access_token,
      account_id: response.data.account_id,
      display_name: response.data.displayName,
      expires_in: response.data.expires_in,
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.errorMessage || "Authentication Failed",
    };
  }
}

// Helper: Create device auth from access token
async function createDeviceAuth(accessToken, accountId) {
  try {
    const response = await axios.post(
      `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/${accountId}/deviceAuth`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      deviceId: response.data.deviceId,
      accountId: response.data.accountId,
      secret: response.data.secret,
      created: response.data.created,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error.response?.data?.errorMessage || "Failed to create device auth",
    };
  }
}

// Helper: Mask email
function maskEmail(email) {
  if (!email || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2) return email;
  return `${local[0]}${"*".repeat(local.length - 2)}${
    local[local.length - 1]
  }@${domain}`;
}

// Helper: Get country flag emoji
function countryToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "";
  return String.fromCodePoint(
    ...countryCode
      .toUpperCase()
      .split("")
      .map((c) => c.charCodeAt(0) + 127397)
  );
}

// Helper: Format date with time
function formatDateTime(dateString) {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Helper: Calculate days ago
function daysAgo(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Helper: Format date
function formatDate(dateString) {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Helper: Fetch cosmetic details with retry
async function fetchCosmeticDetails(cosmeticId, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(
        `https://fortnite-api.com/v2/cosmetics/br/${cosmeticId}`,
        { timeout: 5000 }
      );

      const data = response.data.data;
      return {
        id: cosmeticId,
        name: data.name || cosmeticId,
        rarity: data.rarity?.displayValue || "Common",
        type: data.type?.displayValue || "Unknown",
        image: data.images?.icon || data.images?.smallIcon || null,
      };
    } catch (error) {
      if (i === retries - 1) {
        return {
          id: cosmeticId,
          name: cosmeticId.replace(/_/g, " ").toUpperCase(),
          rarity: "Common",
          type: "Unknown",
          image: null,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

// Helper: Fetch quick account info
async function fetchQuickAccountInfo(access_token, account_id) {
  try {
    const accountResponse = await axios.get(
      `https://account-public-service-prod03.ol.epicgames.com/account/api/public/account/${account_id}`,
      { headers: { Authorization: `bearer ${access_token}` } }
    );
    const account = accountResponse.data;

    const commonCoreResponse = await axios.post(
      `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${account_id}/client/QueryProfile?profileId=common_core`,
      {},
      {
        headers: {
          Authorization: `bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const items =
      commonCoreResponse.data.profileChanges?.[0]?.profile?.items || {};
    let vbucks = 0;
    Object.values(items).forEach((item) => {
      if (item.templateId?.startsWith("Currency:Mtx")) {
        vbucks += item.quantity || 0;
      }
    });

    const athenaResponse = await axios.post(
      `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${account_id}/client/QueryProfile?profileId=athena`,
      {},
      {
        headers: {
          Authorization: `bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const athenaProfile =
      athenaResponse.data.profileChanges?.[0]?.profile || {};
    const athenaItems = athenaProfile.items || {};
    const stats = athenaProfile.stats?.attributes || {};

    let skinCount = 0;
    Object.values(athenaItems).forEach((item) => {
      const tid = item.templateId?.toLowerCase() || "";
      if (tid.includes("athenacharacter") || tid.includes("cid_")) {
        skinCount++;
      }
    });

    const pastSeasons = stats.past_seasons || [];
    const totalWins = pastSeasons.reduce(
      (sum, season) => sum + (season.numWins || 0),
      0
    );

    return {
      success: true,
      email: account.email,
      displayName: account.displayName,
      accountLevel: stats.accountLevel || 0,
      vbucks: vbucks,
      skins: skinCount,
      totalWins: totalWins,
      country: account.country,
      created: account.created,
      tfaEnabled: account.tfaEnabled || false,
      access_token: access_token,
      account_id: account_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ========== ROUTES ==========

// Route: Generate device code for authentication
app.get("/api/auth/device-code", async (req, res) => {
  try {
    const clientToken = await getClientToken();

    const response = await axios.post(
      "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/deviceAuthorization",
      {},
      {
        headers: {
          Authorization: `bearer ${clientToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const deviceData = response.data;

    res.json({
      device_code: deviceData.device_code,
      user_code: deviceData.user_code,
      verification_uri: deviceData.verification_uri,
      verification_uri_complete: deviceData.verification_uri_complete,
      expires_in: deviceData.expires_in,
    });
  } catch (error) {
    console.error("Device code error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate device code" });
  }
});

// Route: Poll for authentication completion
app.post("/api/auth/poll", async (req, res) => {
  try {
    const { device_code } = req.body;

    if (!device_code) {
      return res.status(400).json({ error: "Device code is required" });
    }

    const response = await axios.post(
      "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token",
      `grant_type=device_code&device_code=${device_code}`,
      {
        headers: {
          Authorization: `basic ${SWITCH_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const tokenData = response.data;

    const exchangeResponse = await axios.get(
      "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/exchange",
      {
        headers: {
          Authorization: `bearer ${tokenData.access_token}`,
        },
      }
    );

    const iosResponse = await axios.post(
      "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token",
      `grant_type=exchange_code&exchange_code=${exchangeResponse.data.code}`,
      {
        headers: {
          Authorization: `basic ${IOS_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const finalToken = iosResponse.data;

    res.json({
      success: true,
      access_token: finalToken.access_token,
      account_id: finalToken.account_id,
      display_name: finalToken.displayName,
    });
  } catch (error) {
    if (error.response?.status === 400) {
      res.json({ pending: true });
    } else {
      console.error("Poll error:", error.response?.data || error.message);
      res.status(500).json({ error: "Authentication failed" });
    }
  }
});

// NEW Route: Generate device auth credentials
app.post("/api/auth/generate-device-auth", async (req, res) => {
  try {
    const { access_token, account_id } = req.body;

    if (!access_token || !account_id) {
      return res
        .status(400)
        .json({ error: "Access token and account ID required" });
    }

    const deviceAuth = await createDeviceAuth(access_token, account_id);

    if (deviceAuth.success) {
      res.json({
        success: true,
        deviceAuth: {
          deviceId: deviceAuth.deviceId,
          accountId: deviceAuth.accountId,
          secret: deviceAuth.secret,
        },
      });
    } else {
      res.status(500).json({ error: deviceAuth.error });
    }
  } catch (error) {
    console.error("Generate device auth error:", error);
    res.status(500).json({ error: "Failed to generate device auth" });
  }
});

// NEW Route: Bulk check with device auth
app.post("/api/auth/bulk-check-device", async (req, res) => {
  try {
    const { accounts } = req.body; // Array of { deviceId, accountId, secret }

    if (!accounts || !Array.isArray(accounts)) {
      return res.status(400).json({ error: "Accounts array is required" });
    }

    console.log(
      `\n🔍 Starting bulk check for ${accounts.length} accounts (Device Auth)...\n`
    );

    const results = [];

    for (let i = 0; i < accounts.length; i++) {
      const { deviceId, accountId, secret, label } = accounts[i];
      console.log(
        `[${i + 1}/${accounts.length}] Testing: ${label || accountId}`
      );

      const authResult = await authenticateWithDeviceAuth(
        deviceId,
        accountId,
        secret
      );

      if (!authResult.success) {
        console.log(`   ❌ ${authResult.error}`);
        results.push({
          label: label || accountId,
          accountId: accountId,
          status: "failed",
          message: authResult.error,
          data: null,
        });
      } else {
        console.log(`   ✅ Valid - Fetching data...`);

        const accountInfo = await fetchQuickAccountInfo(
          authResult.access_token,
          authResult.account_id
        );

        if (accountInfo.success) {
          console.log(
            `   📊 ${accountInfo.displayName} - ${accountInfo.skins} skins, ${accountInfo.vbucks} V-Bucks`
          );
          results.push({
            label: label || accountId,
            accountId: accountId,
            status: "success",
            message: "Valid Account",
            data: accountInfo,
          });
        } else {
          results.push({
            label: label || accountId,
            accountId: accountId,
            status: "success",
            message: "Valid (Data fetch failed)",
            data: {
              displayName: authResult.display_name,
              access_token: authResult.access_token,
              account_id: authResult.account_id,
            },
          });
        }
      }

      if (i < accounts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(
      `\n✅ Bulk check completed: ${
        results.filter((r) => r.status === "success").length
      } valid, ${results.filter((r) => r.status === "failed").length} failed\n`
    );

    res.json({
      success: true,
      results: results,
      summary: {
        total: accounts.length,
        valid: results.filter((r) => r.status === "success").length,
        failed: results.filter((r) => r.status === "failed").length,
      },
    });
  } catch (error) {
    console.error("Bulk check error:", error);
    res
      .status(500)
      .json({ error: "Bulk check failed", details: error.message });
  }
});

// Route: Fetch complete account data
app.post("/api/account/data", async (req, res) => {
  try {
    const { access_token, account_id } = req.body;

    if (!access_token || !account_id) {
      return res
        .status(400)
        .json({ error: "Access token and account ID are required" });
    }

    console.log(`\n🎮 Fetching detailed data for account: ${account_id}`);

    const accountResponse = await axios.get(
      `https://account-public-service-prod03.ol.epicgames.com/account/api/public/account/${account_id}`,
      { headers: { Authorization: `bearer ${access_token}` } }
    );

    const account = accountResponse.data;
    console.log(`✅ Account fetched: ${account.displayName}`);

    const externalAuthsResponse = await axios.get(
      `https://account-public-service-prod03.ol.epicgames.com/account/api/public/account/${account_id}/externalAuths`,
      { headers: { Authorization: `bearer ${access_token}` } }
    );
    const externalAuths = externalAuthsResponse.data;

    const commonCoreResponse = await axios.post(
      `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${account_id}/client/QueryProfile?profileId=common_core`,
      {},
      {
        headers: {
          Authorization: `bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const commonCoreProfile =
      commonCoreResponse.data.profileChanges?.[0]?.profile || {};
    const commonCoreItems = commonCoreProfile.items || {};
    const commonCoreStats = commonCoreProfile.stats?.attributes || {};

    let vbucks = 0;
    Object.values(commonCoreItems).forEach((item) => {
      if (item.templateId?.startsWith("Currency:Mtx")) {
        vbucks += item.quantity || 0;
      }
    });

    const athenaResponse = await axios.post(
      `https://fortnite-public-service-prod11.ol.epicgames.com/fortnite/api/game/v2/profile/${account_id}/client/QueryProfile?profileId=athena`,
      {},
      {
        headers: {
          Authorization: `bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const athenaProfile =
      athenaResponse.data.profileChanges?.[0]?.profile || {};
    const athenaItems = athenaProfile.items || {};
    const stats = athenaProfile.stats?.attributes || {};

    const cosmetics = {
      skins: [],
      backblings: [],
      pickaxes: [],
      emotes: [],
      gliders: [],
    };

    for (const [itemId, itemData] of Object.entries(athenaItems)) {
      const templateId = itemData.templateId?.toLowerCase() || "";

      if (templateId.includes("loadingscreen")) continue;

      if (
        templateId.includes("athenacharacter") ||
        templateId.includes("cid_")
      ) {
        cosmetics.skins.push({ id: itemId, templateId: itemData.templateId });
      } else if (
        templateId.includes("athenabackpack") ||
        templateId.includes("bid_")
      ) {
        cosmetics.backblings.push({
          id: itemId,
          templateId: itemData.templateId,
        });
      } else if (
        templateId.includes("athenapickaxe") ||
        templateId.includes("pickaxe_id")
      ) {
        cosmetics.pickaxes.push({
          id: itemId,
          templateId: itemData.templateId,
        });
      } else if (
        templateId.includes("athenadance") ||
        templateId.includes("eid_")
      ) {
        cosmetics.emotes.push({ id: itemId, templateId: itemData.templateId });
      } else if (
        templateId.includes("athenaglider") ||
        templateId.includes("glider_id")
      ) {
        cosmetics.gliders.push({ id: itemId, templateId: itemData.templateId });
      }
    }

    console.log(`📊 Cosmetics: ${cosmetics.skins.length} skins`);

    for (const [type, items] of Object.entries(cosmetics)) {
      if (items.length === 0) continue;

      const batchSize = 20;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        const promises = batch.map((item) => {
          const cosmeticId = item.templateId.split(":")[1]?.toLowerCase();
          return cosmeticId ? fetchCosmeticDetails(cosmeticId) : null;
        });

        const results = await Promise.all(promises);

        results.forEach((result, idx) => {
          if (result) items[i + idx] = result;
        });

        if (i + batchSize < items.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }

    const pastSeasons = stats.past_seasons || [];
    const totalWins = pastSeasons.reduce(
      (sum, season) => sum + (season.numWins || 0),
      0
    );
    const totalMatches = pastSeasons.reduce(
      (sum, season) =>
        sum + (season.numHighBracket || 0) + (season.numLowBracket || 0),
      0
    );

    const lastMatchDate = stats.last_match_end_datetime;
    const daysSinceLastMatch = lastMatchDate ? daysAgo(lastMatchDate) : null;

    const seasonDetails = pastSeasons.map((season) => ({
      seasonNumber: season.seasonNumber,
      wins: season.numWins || 0,
      seasonLevel: season.seasonLevel || 0,
      battlepassLevel: season.bookLevel || 0,
      purchasedBattlepass: season.purchasedVIP || false,
    }));

    const currentSeason = {
      battlepassLevel: stats.book_level || 0,
      purchasedBattlepass: stats.book_purchased || false,
      seasonLevel: stats.level || 0,
    };

    const refundInfo = {
      refundsUsed: commonCoreStats.mtx_purchase_history?.refundsUsed || 0,
      refundsRemaining:
        3 - (commonCoreStats.mtx_purchase_history?.refundsUsed || 0),
    };

    const giftInfo = {
      giftsSent: commonCoreStats.gifts_sent || 0,
      giftsReceived: commonCoreStats.gifts_received || 0,
      allowedToReceiveGifts: commonCoreStats.allowed_to_receive_gifts || false,
    };

    let founderEdition = "None";
    Object.values(commonCoreItems).forEach((item) => {
      const tid = item.templateId?.toLowerCase() || "";
      if (tid.includes("founder")) founderEdition = item.templateId;
    });

    res.json({
      success: true,
      data: {
        account: {
          id: account.id,
          email: account.email,
          maskedEmail: maskEmail(account.email),
          displayName: account.displayName,
          name: account.name || "",
          country: account.country,
          countryFlag: countryToFlag(account.country),
          canUpdateDisplayName: account.canUpdateDisplayName || false,
          lastDisplayNameChange: account.lastDisplayNameChange
            ? formatDateTime(account.lastDisplayNameChange)
            : "Never",
          lastLogin: formatDateTime(account.lastLogin),
          created: formatDateTime(account.created),
          tfaEnabled: account.tfaEnabled || false,
          emailVerified: account.emailVerified || false,
          minorVerified: account.minorVerified || false,
          minorExpected: account.minorExpected || false,
          vbucks: vbucks,
          externalAuths: externalAuths,
        },
        stats: {
          accountLevel: stats.accountLevel || 0,
          totalWins: totalWins,
          totalMatches: totalMatches,
          lastMatchDate: lastMatchDate
            ? formatDateTime(lastMatchDate)
            : "Never",
          daysSinceLastMatch: daysSinceLastMatch,
          seasonDetails: seasonDetails,
          currentSeason: currentSeason,
        },
        refunds: refundInfo,
        gifts: giftInfo,
        founderEdition: founderEdition,
        cosmetics: cosmetics,
        counts: {
          skins: cosmetics.skins.length,
          backblings: cosmetics.backblings.length,
          pickaxes: cosmetics.pickaxes.length,
          emotes: cosmetics.emotes.length,
          gliders: cosmetics.gliders.length,
        },
      },
    });

    console.log(`✅ Detailed data sent\n`);
  } catch (error) {
    console.error(
      "❌ Account data error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      error: "Failed to fetch account data",
      details: error.response?.data || error.message,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Fortnite Checker API running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(
    `\n⚠️  NOTE: Email:Password login is NOT supported by Epic Games API`
  );
  console.log(`✅ Use Device Auth method for bulk checking\n`);
});
