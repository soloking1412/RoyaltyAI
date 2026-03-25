let tokenFeedItems = [];

function selectTokenFromDropdown() {
  const sel = document.getElementById('tokenSelect');
  const tokenMint = (sel && sel.value) ? sel.value : '';
  if (tokenMint) document.getElementById('tokenMint').value = tokenMint;
}

async function loadTokenFeed() {
  const out = document.getElementById('insightsOut');
  out.textContent = 'Loading token feed...';
  out.style.color = '#FCD34D'; // loading color
  try {
    const res = await fetch('/api/token/feed');
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Token feed failed');
    tokenFeedItems = json.response || [];
    const sel = document.getElementById('tokenSelect');
    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a token...';
    sel.appendChild(placeholder);

    tokenFeedItems.slice(0, 200).forEach((it) => {
      const opt = document.createElement('option');
      opt.value = it.tokenMint;
      opt.textContent = it.symbol + ' - ' + it.name;
      sel.appendChild(opt);
    });

    out.style.color = '#4ADE80';
    out.textContent = 'Loaded ' + tokenFeedItems.length + ' token launches. Check the dropdown.';
  } catch (e) {
    out.style.color = '#F87171';
    out.textContent = String(e);
  }
}

let agentAuthPublicIdentifier = '';

async function agentAuthInit() {
  const agentUsername = document.getElementById('agentUsername').value.trim();
  if (!agentUsername) { alert('Enter agentUsername'); return; }
  document.getElementById('agentInitOut').textContent = 'Loading...';
  try {
    const res = await fetch('/api/agent/auth/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agentUsername })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'agent auth init failed');
    agentAuthPublicIdentifier = json.response.publicIdentifier;
    document.getElementById('agentInitOut').textContent = JSON.stringify(json.response, null, 2);
    document.getElementById('agentToken').value = '';
    document.getElementById('agentWallets').textContent = 'Wallets: Ready.';
  } catch (e) {
    document.getElementById('agentInitOut').textContent = String(e);
  }
}

async function agentAuthLogin() {
  const postId = document.getElementById('agentPostId').value.trim();
  if (!agentAuthPublicIdentifier) { alert('Run Start agent auth first'); return; }
  if (!postId) { alert('Enter postId'); return; }
  document.getElementById('agentInitOut').textContent = 'Completing auth...';
  try {
    const res = await fetch('/api/agent/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ publicIdentifier: agentAuthPublicIdentifier, postId })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'agent auth login failed');
    document.getElementById('agentToken').value = json.response.token || '';
    document.getElementById('agentInitOut').textContent = JSON.stringify(json.response, null, 2);
  } catch (e) {
    document.getElementById('agentInitOut').textContent = String(e);
  }
}

function getSelectedWallets() {
  const boxes = document.querySelectorAll('#agentWallets input[type="checkbox"]:checked');
  const wallets = [];
  boxes.forEach((b) => wallets.push(b.value));
  return wallets;
}

function syncSelectedFeeClaimer() {
  const wallets = getSelectedWallets();
  if (wallets.length) document.getElementById('feeClaimer').value = wallets[0];
}

async function loadAgentWallets() {
  const token = document.getElementById('agentToken').value.trim();
  if (!token) { alert('Generate agent JWT token first'); return; }
  document.getElementById('agentWallets').textContent = 'Loading wallets...';
  try {
    const res = await fetch('/api/agent/wallet/list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'wallet list failed');
    const wallets = json.response || [];
    const container = document.getElementById('agentWallets');
    container.innerHTML = '';
    if (!wallets.length) {
      container.textContent = 'No wallets returned.';
      return;
    }

    wallets.forEach((w) => {
      const label = document.createElement('label');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = w;
      checkbox.addEventListener('change', syncSelectedFeeClaimer);

      const text = document.createTextNode(' ' + w);
      label.appendChild(checkbox);
      label.appendChild(text);
      container.appendChild(label);
    });

    syncSelectedFeeClaimer();
  } catch (e) {
    document.getElementById('agentWallets').textContent = String(e);
  }
}

async function buildBulkClaimTxs() {
  const tokenMint = document.getElementById('tokenMint').value.trim();
  if (!tokenMint) { alert('Enter token mint'); return; }
  const feeClaimers = getSelectedWallets();
  if (!feeClaimers.length) { alert('Select at least one wallet'); return; }
  if (feeClaimers.length > 20) { alert('Select up to 20 wallets (API limit)'); return; }
  document.getElementById('payloadBulkOut').textContent = 'Loading...';
  try {
    const res = await fetch('/api/token/claim-txs/v3/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenMint, feeClaimers })
    });
    const json = await res.json();
    document.getElementById('payloadBulkOut').textContent = JSON.stringify(json, null, 2);
  } catch (e) {
    document.getElementById('payloadBulkOut').textContent = String(e);
  }
}

async function runInsights() {
  const tokenMint = document.getElementById('tokenMint').value.trim();
  if (!tokenMint) { alert('Enter token mint'); return; }
  
  const ids = ['insightsOut', 'leaderboardOut', 'velocityOut', 'recommendationsOut'];
  ids.forEach(id => {
      const el = document.getElementById(id);
      el.textContent = 'Loading...';
      el.style.color = '#FCD34D';
  });

  try {
    const res = await fetch('/api/royalty/insights?tokenMint=' + encodeURIComponent(tokenMint));
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Insights failed');
    const insights = json.response;

    ids.forEach(id => document.getElementById(id).style.color = '#4ADE80');
    document.getElementById('insightsOut').textContent = JSON.stringify(insights, null, 2);

    const top = (insights.topClaimers || []).slice(0, 8);
    const leaderboardLines = top.map((c, i) => {
      const share =
        c.shareOfCreatorTotalBps === null || c.shareOfCreatorTotalBps === undefined
          ? 'shareOfCreator: n/a'
          : 'shareOfCreator: ' + (c.shareOfCreatorTotalBps / 100).toFixed(2) + '%';
      return (
        (i + 1) +
        '. ' +
        (c.username || c.wallet.slice(0, 6)) +
        ' (' +
        c.wallet.slice(0, 6) +
        '...) claimed ' +
        c.totalClaimedSol +
        ' SOL, royaltyBps=' +
        c.royaltyBps +
        '. ' +
        share
      );
    });
    document.getElementById('leaderboardOut').textContent = leaderboardLines.length ? leaderboardLines.join('\n') : 'No claimers found.';

    const cv = insights.claimVelocity;
    if (cv) {
      document.getElementById('velocityOut').textContent =
        'Total claim volume (last ' +
        cv.periodDays +
        'd): ' +
        cv.totalSol +
        ' SOL\n' +
        'Velocity: ~' +
        cv.solPerDay +
        ' SOL/day\n' +
        'Creator portion: ' +
        cv.creatorSol +
        ' SOL';
    } else {
      document.getElementById('velocityOut').textContent = 'No claim velocity computed.';
    }

    const recs = insights.recommendations || [];
    const recLines = recs.map((r) => {
      const action = r.action ? '\nAction: ' + r.action : '';
      return (
        '[' + r.severity.toUpperCase() + '][' + r.type + '] ' + r.title + action + '\n' + r.detail
      );
    });
    
    const recBlock = document.getElementById('recommendationsOut');
    recBlock.textContent = recLines.length ? recLines.join('\n\n') : 'No recommendations.';
    recBlock.style.color = '#A78BFA';
  } catch (e) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        el.textContent = String(e);
        el.style.color = '#F87171';
    });
  }
}

async function runPlan() {
  const tokenMint = document.getElementById('tokenMint').value.trim();
  if (!tokenMint) { alert('Enter token mint'); return; }
  const inputMint = document.getElementById('inputMint').value.trim();
  const slippageBps = Number(document.getElementById('slippageBps').value.trim());
  const actionText = document.getElementById('actionText').value;
  
  const out = document.getElementById('planOut');
  out.textContent = 'Generating AI Plan...';
  out.style.color = '#FCD34D';
  
  try {
    const res = await fetch('/api/ai/plan-buyback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenMint, inputMint, slippageBps, actionText })
    });
    const json = await res.json();
    out.style.color = '#4ADE80';
    out.textContent = JSON.stringify(json, null, 2);
  } catch (e) {
    out.style.color = '#F87171';
    out.textContent = String(e);
  }
}

async function buildClaimTxs() {
  const tokenMint = document.getElementById('tokenMint').value.trim();
  const feeClaimer = document.getElementById('feeClaimer').value.trim();
  if (!tokenMint || !feeClaimer) { alert('Enter token mint + fee claimer'); return; }
  document.getElementById('payloadOut').textContent = 'Loading...';
  try {
    const res = await fetch('/api/token/claim-txs/v3', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tokenMint, feeClaimer })
    });
    const json = await res.json();
    document.getElementById('payloadOut').textContent = JSON.stringify(json, null, 2);
  } catch (e) {
    document.getElementById('payloadOut').textContent = String(e);
  }
}

async function buildSwapTx() {
  const quoteResponseText = document.getElementById('quoteResponse').value.trim();
  if (!quoteResponseText) { alert('Paste quoteResponse JSON'); return; }
  let quoteResponse;
  try { quoteResponse = JSON.parse(quoteResponseText); } catch (e) { alert('quoteResponse must be valid JSON'); return; }

  const userPublicKey = prompt('Enter your wallet public key to bind swap-tx (userPublicKey):');
  if (!userPublicKey) return;

  document.getElementById('payloadOut').textContent = 'Loading...';
  try {
    const res = await fetch('/api/trade/swap-tx', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quoteResponse, userPublicKey })
    });
    const json = await res.json();
    document.getElementById('payloadOut').textContent = JSON.stringify(json, null, 2);
  } catch (e) {
    document.getElementById('payloadOut').textContent = String(e);
  }
}
