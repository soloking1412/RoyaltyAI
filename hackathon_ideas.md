# Bags.fm Hackathon Research & Project Ideas

## Hackathon Overview
The Bags Hackathon offers **$4,000,000 in funding**, with $1M distributed as grants ($10k-$100k) to the top 100 teams. The core evaluation criteria are:
1. **Real Traction**: Onchain performance (market cap, volume) and app traction (DAU, MRR).
2. **Deep Integration**: Must use the Bags API, release a fee-sharing app, or have a Bags token. The deeper the integration, the higher the rank.
3. **Categories**: Bags API, Fee Sharing, AI Agents, Claude Skills, DeFi, Payments, Privacy, Social Finance.

## Summarized Project Ideas

### 1. BagsGated (Social Finance + Fee Sharing)
A platform where creators offer exclusive content (videos, posts, private communities) gated by their Bags.fm token. 
* **Mechanism**: Users must hold a specific amount of the creator's token to access content. The platform charges a small transaction fee (fee-sharing) on top of the creator's perpetual 1% royalty.
* **Why it works**: Directly increases token utility and trading volume (boosting on-chain traction).

### 2. YieldBags (DeFi + Bags API)
A yield aggregator specifically designed for Bags.fm creators.
* **Mechanism**: Creators automatically funnel their 1% perpetual royalties into an aggregated vault. The protocol deploys this liquidity into high-yield Solana DeFi protocols (like Meteora) to compound earnings.
* **Why it works**: Solves a real problem for creators (managing crypto earnings) and brings DeFi volume to the Bags ecosystem.

### 3. BagsBot Community Manager (AI Agents + Social Finance)
An AI agent deployed as a Discord/Telegram bot that analyzes community sentiment and token trading metrics using the Bags API.
* **Mechanism**: The bot rewards active community members with micro-airdrops of the creator's token or exclusive roles based on their on-chain Bags.fm trading activity.

---

## 🏆 The Best Idea to Build: "RoyaltyAI"

**Category**: AI Agents, Claude Skills, Bags API, Fee Sharing
**Concept**: An Autonomous Treasury Manager for Creators.

### Why this is the winning idea:
Most creators launching tokens on Bags.fm earn the 1% perpetual royalty but lack the Web3 financial expertise to grow or utilize it effectively. **RoyaltyAI** acts as their autonomous financial manager.

### Key Features:
1. **Automated Yield Generation**: The AI monitors the creator's Bags.fm wallet. When 1% royalty fees accumulate, it automatically routes them into low-risk Solana DeFi yield strategies (Meteora/Kamino) using smart routing.
2. **Token Buybacks & Burns**: The creator can prompt the AI (using a Claude Skill interface): *"Use 20% of my royalties this week to buy back and burn my token."* The AI executes this via the Bags API and Solana AMMs.
3. **Community Rewards**: The AI analyzes Bags API volume data. If it detects a dip in trading volume, it can autonomously suggest: *"Trading volume is down 15%. Should I use $500 from the treasury to launch a trading competition on Bags.fm?"*
4. **Fee-Sharing Model**: The RoyaltyAI platform takes a tiny protocol fee (0.1%) on the yield generated, instantly fulfilling the hackathon's fee-sharing requirement.

### How to execute it:
* **Frontend**: Next.js dashboard for creators to view their AI's actions and treasury growth.
* **Backend**: Node.js utilizing the Bags API to track royalties and user volume.
* **AI Layer**: Anthropic Claude API (Claude Skills) to process creator natural language prompts into on-chain Solana transactions.
* **Smart Contracts**: A Solana program to securely handle the automated routing, compounding, and protocol fee-sharing.

This idea sits perfectly at the intersection of the most lucrative hackathon tracks (AI, DeFi, Bags API) and guarantees high transactional volume, making it highly competitive for a $100k grant.
