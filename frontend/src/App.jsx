import { useState } from "react";
import {
  Search,
  Shield,
  Trophy,
  Calendar,
  Mail,
  Globe,
  DollarSign,
  Loader2,
  User,
  Clock,
  Gift,
  Ban,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

export default function FortniteChecker() {
  const [isLoading, setIsLoading] = useState(false);
  const [authStep, setAuthStep] = useState("initial");
  const [deviceCode, setDeviceCode] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const [cosmetics, setCosmetics] = useState({});
  const [counts, setCounts] = useState({});
  const [selectedTab, setSelectedTab] = useState("account");
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  const startAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/auth/device-code`);
      const data = await response.json();

      setDeviceCode(data);
      setAuthStep("waiting");
      window.open(data.verification_uri_complete, "_blank");
      pollForAuth(data.device_code);
    } catch (err) {
      setError("Failed to start authentication: " + err.message);
      setIsLoading(false);
    }
  };

  const pollForAuth = async (code) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setError("Authentication timed out. Please try again.");
        setIsLoading(false);
        setAuthStep("initial");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_code: code }),
        });

        const data = await response.json();

        if (data.success) {
          setUserInfo({
            access_token: data.access_token,
            account_id: data.account_id,
            display_name: data.display_name,
          });
          setAuthStep("authenticated");
          await fetchAccountData(data.access_token, data.account_id);
        } else if (data.pending) {
          attempts++;
          setTimeout(poll, 5000);
        } else {
          throw new Error(data.error || "Authentication failed");
        }
      } catch (err) {
        setError("Authentication error: " + err.message);
        setIsLoading(false);
        setAuthStep("initial");
      }
    };

    poll();
  };

  const fetchAccountData = async (accessToken, accountId) => {
    try {
      console.log("Fetching account data for:", accountId);

      const response = await fetch(`${API_URL}/account/data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          account_id: accountId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAccountData(data.data);
        setCosmetics(data.data.cosmetics);
        setCounts(data.data.counts);
        console.log("Account data loaded successfully");
      } else {
        throw new Error(data.error || "Failed to fetch account data");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load account data: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setAuthStep("initial");
    setDeviceCode(null);
    setAccountData(null);
    setCosmetics({});
    setCounts({});
    setUserInfo(null);
    setError(null);
  };

  if (isLoading || authStep === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full text-center">
          <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-400 animate-spin" />
          <h2 className="text-2xl font-bold text-white mb-2">
            {authStep === "waiting"
              ? "Waiting for Authorization"
              : "Loading Data..."}
          </h2>
          <p className="text-gray-300 mb-4">
            {authStep === "waiting"
              ? "Please complete the login in the opened window"
              : "Fetching your account details and cosmetics..."}
          </p>
          {deviceCode && (
            <div className="bg-white/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-300 mb-2">Your Code:</p>
              <p className="text-3xl font-bold text-white tracking-wider">
                {deviceCode.user_code}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (authStep === "initial") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <Shield className="w-20 h-20 mx-auto mb-4 text-blue-400" />
            <h1 className="text-4xl font-bold text-white mb-2">
              Fortnite Checker
            </h1>
            <p className="text-gray-300">
              Check your account stats and cosmetics
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-4">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={startAuth}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <Shield className="w-5 h-5" />
            Login with Epic Games
          </button>

          <div className="mt-6 text-center text-sm text-gray-400">
            <p>Secure authentication through Epic Games</p>
            <p className="mt-2">We never see your password</p>
          </div>
        </div>
      </div>
    );
  }

  // Render authenticated dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">
                Fortnite Checker
              </h1>
              {userInfo && (
                <p className="text-sm text-gray-400">
                  Welcome, {userInfo.display_name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={logout}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: "account", label: "Account" },
            { key: "stats", label: "Stats" },
            { key: "seasons", label: "Seasons" },
            { key: "refunds", label: "Refunds & Gifts" },
            { key: "skins", label: `Skins (${counts.skins || 0})` },
            {
              key: "backblings",
              label: `Backblings (${counts.backblings || 0})`,
            },
            { key: "pickaxes", label: `Pickaxes (${counts.pickaxes || 0})` },
            { key: "emotes", label: `Emotes (${counts.emotes || 0})` },
            { key: "gliders", label: `Gliders (${counts.gliders || 0})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
                selectedTab === tab.key
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8">
        {selectedTab === "account" && accountData && (
          <AccountInfo account={accountData.account} />
        )}
        {selectedTab === "stats" && accountData && (
          <StatsInfo stats={accountData.stats} />
        )}
        {selectedTab === "seasons" && accountData && (
          <SeasonsInfo seasons={accountData.stats.seasonDetails} />
        )}
        {selectedTab === "refunds" && accountData && (
          <RefundsGiftsInfo
            refunds={accountData.refunds}
            gifts={accountData.gifts}
            founder={accountData.founderEdition}
          />
        )}
        {["skins", "backblings", "pickaxes", "emotes", "gliders"].map(
          (type) =>
            selectedTab === type &&
            cosmetics[type] && (
              <CosmeticsGrid key={type} items={cosmetics[type]} type={type} />
            )
        )}
      </div>
    </div>
  );
}

const BoolIcon = ({ value }) =>
  value ? (
    <CheckCircle className="w-5 h-5 text-green-400" />
  ) : (
    <XCircle className="w-5 h-5 text-red-400" />
  );

function AccountInfo({ account }) {
  const infoItems = [
    { icon: Shield, label: "Account ID", value: account.id },
    { icon: User, label: "Display Name", value: account.displayName },
    { icon: Mail, label: "Email", value: account.maskedEmail },
    {
      icon: User,
      label: "Full Name",
      value: account.name + " " + account.lastName || "Not set",
    },
    {
      icon: Globe,
      label: "Country",
      value: `${account.country} ${account.countryFlag}`,
    },
    {
      icon: DollarSign,
      label: "V-Bucks",
      value: account.vbucks?.toLocaleString() || "0",
    },
    { icon: Calendar, label: "Created", value: account.created },
    { icon: Clock, label: "Last Login", value: account.lastLogin },
    {
      icon: RefreshCw,
      label: "Last Display Name Change",
      value: account.lastDisplayNameChange,
    },
  ];

  const boolItems = [
    { label: "Can Change Display Name", value: account.canUpdateDisplayName },
    { label: "2FA Enabled", value: account.tfaEnabled },
    { label: "Email Verified", value: account.emailVerified },
    { label: "Parental Controls", value: account.minorVerified },
  ];

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {infoItems.map((item, idx) => (
          <div
            key={idx}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <item.icon className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400 text-xs">{item.label}</span>
            </div>
            <p className="text-white text-sm font-semibold break-all">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {boolItems.map((item, idx) => (
          <div
            key={idx}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 flex items-center justify-between"
          >
            <span className="text-gray-300 text-sm">{item.label}</span>
            <BoolIcon value={item.value} />
          </div>
        ))}
      </div>

      {account.externalAuths && account.externalAuths.length > 0 && (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-4">
            Connected Accounts
          </h3>
          <div className="space-y-3">
            {account.externalAuths.map((auth, idx) => (
              <div key={idx} className="bg-white/5 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">{auth.type}</span>
                  <span className="text-gray-400 text-sm">
                    {auth.externalDisplayName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatsInfo({ stats }) {
  const statItems = [
    { icon: Trophy, label: "Account Level", value: stats.accountLevel },
    { icon: Trophy, label: "Lifetime Wins", value: stats.totalWins },
    { icon: Search, label: "Total Matches", value: stats.totalMatches },
    {
      icon: Calendar,
      label: "Last Match",
      value: stats.daysSinceLastMatch
        ? `${stats.daysSinceLastMatch} days ago`
        : "Never",
    },
  ];

  const currentSeasonItems = [
    { label: "Battlepass Level", value: stats.currentSeason.battlepassLevel },
    { label: "Season Level", value: stats.currentSeason.seasonLevel },
    {
      label: "Purchased Battlepass",
      value: stats.currentSeason.purchasedBattlepass,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((item, idx) => (
          <div
            key={idx}
            className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-lg rounded-xl p-6 border border-white/20"
          >
            <div className="flex items-center gap-3 mb-2">
              <item.icon className="w-6 h-6 text-purple-400" />
              <span className="text-gray-300 text-sm">{item.label}</span>
            </div>
            <p className="text-white text-3xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4">
          Current Season Information
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {currentSeasonItems.map((item, idx) => (
            <div key={idx} className="bg-white/5 rounded-lg p-4">
              <span className="text-gray-400 text-sm block mb-2">
                {item.label}
              </span>
              {typeof item.value === "boolean" ? (
                <BoolIcon value={item.value} />
              ) : (
                <span className="text-white text-2xl font-bold">
                  {item.value}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeasonsInfo({ seasons }) {
  if (!seasons || seasons.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12">
        No season data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold text-white mb-4">Battlepass History</h2>
      {seasons.map((season, idx) => (
        <div
          key={idx}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500 text-white rounded-lg px-4 py-2 font-bold">
                Season {season.seasonNumber}
              </div>
              <div className="text-white">
                <span className="text-sm text-gray-400">Wins: </span>
                <span className="font-bold">{season.wins}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-white">
                <span className="text-sm text-gray-400">Season Level: </span>
                <span className="font-bold">{season.seasonLevel}</span>
              </div>
              <div className="text-white">
                <span className="text-sm text-gray-400">BP Level: </span>
                <span className="font-bold">{season.battlepassLevel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Purchased:</span>
                <BoolIcon value={season.purchasedBattlepass} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RefundsGiftsInfo({ refunds, gifts, founder }) {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="w-6 h-6 text-orange-400" />
            <h3 className="text-xl font-bold text-white">Refund Information</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Refunds Used</span>
              <span className="text-white font-bold">
                {refunds.refundsUsed}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Refunds Remaining</span>
              <span className="text-green-400 font-bold">
                {refunds.refundsRemaining}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-6 h-6 text-pink-400" />
            <h3 className="text-xl font-bold text-white">Gift Information</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Gifts Sent</span>
              <span className="text-white font-bold">{gifts.giftsSent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Gifts Received</span>
              <span className="text-white font-bold">
                {gifts.giftsReceived}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Can Receive Gifts</span>
              <BoolIcon value={gifts.allowedToReceiveGifts} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-lg rounded-xl p-6 border border-yellow-500/30">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-yellow-400" />
          <h3 className="text-xl font-bold text-white">Founder's Edition</h3>
        </div>
        <p className="text-white text-lg">
          {founder === "None" ? "No Founder Pack" : founder}
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <div className="flex items-center gap-3 mb-4">
          <Ban className="w-6 h-6 text-green-400" />
          <h3 className="text-xl font-bold text-white">Ban Information</h3>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-green-400 font-semibold">
            No active sanctions found
          </span>
        </div>
      </div>
    </div>
  );
}

function CosmeticsGrid({ items, type }) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-12 text-center border border-white/20">
        <p className="text-gray-400 text-lg">No {type} found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-xl p-3 border border-white/20 hover:border-blue-400/50 transition-all hover:scale-105 cursor-pointer group"
        >
          <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
              />
            ) : (
              <Search className="w-12 h-12 text-gray-500" />
            )}
          </div>
          <div
            className={`inline-block px-2 py-1 rounded text-xs font-bold mb-2 ${getRarityColor(
              item.rarity
            )}`}
          >
            {item.rarity}
          </div>
          <p className="text-white font-semibold text-sm truncate">
            {item.name}
          </p>
        </div>
      ))}
    </div>
  );
}

function getRarityColor(rarity) {
  const colors = {
    Common: "bg-gray-500 text-white",
    Uncommon: "bg-green-500 text-white",
    Rare: "bg-blue-500 text-white",
    Epic: "bg-purple-500 text-white",
    Legendary: "bg-orange-500 text-white",
    Mythic: "bg-yellow-400 text-black",
    "Icon Series": "bg-cyan-400 text-black",
  };
  return colors[rarity] || "bg-gray-500 text-white";
}
