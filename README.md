# Bolt for JavaScript (TypeScript) Template App

This is a generic Bolt for JavaScript (TypeScript) template app used to build out Slack apps.

Before getting started, make sure you have a development workspace where you have permissions to install apps. If you don’t have one setup, go ahead and [create one](https://slack.com/create).

## Installation

#### Create a Slack App

1. Open [https://api.slack.com/apps/new](https://api.slack.com/apps/new) and choose "From an app manifest"
2. Choose the workspace you want to install the application to
3. Copy the contents of [manifest.json](./manifest.json) into the text box that says `*Paste your manifest code here*` (within the JSON tab) and click _Next_
4. Review the configuration and click _Create_
5. Click _Install to Workspace_ and _Allow_ on the screen that follows. You'll then be redirected to the App Configuration dashboard.

#### Environment Variables

Before you can run the app, you'll need to store some environment variables.

1. Copy `env.sample` to `.env`
2. Open your apps configuration page from [this list](https://api.slack.com/apps), click _OAuth & Permissions_ in the left hand menu, then copy the _Bot User OAuth Token_ into your `.env` file under `SLACK_BOT_TOKEN`
3. Click _Basic Information_ from the left hand menu and follow the steps in the _App-Level Tokens_ section to create an app-level token with the `connections:write` scope. Copy that token into your `.env` as `SLACK_APP_TOKEN`.

#### Install Dependencies

`npm install`

#### Run Bolt Server

`npm start`

## 사용 방법

### 🚀 **간단한 2-테이블 구조** (NEW!)
- **채널 테이블**: 채널 정보 + 채널 전체 임베딩
- **쓰레드 테이블**: 쓰레드 정보 + 쓰레드별 임베딩

### 💬 멘션 동작

1. **채널에서 멘션**: `@MOKOKO 질문 내용`
   - 📂 채널 전체 활동 분석 및 요약 생성
   - 🤖 채널 임베딩 생성 및 저장
   - 🔍 기존 데이터에서 관련 정보 검색
   - 💡 질문에 대한 AI 답변 제공

2. **쓰레드에서 멘션**: `@MOKOKO 질문 내용`
   - 📥 쓰레드 전체 대화 수집 (모든 메시지)
   - 📝 AI가 대화 내용 요약 생성
   - 🏷️ 자동 카테고리 분류 (technical, question, discussion 등)
   - 🤖 쓰레드 임베딩 생성 및 저장
   - 🔍 쓰레드 맥락 기반 정확한 답변 제공

### ✨ 주요 특징
- **📊 자동 메타데이터**: 참여자 수, 답글 수, 마지막 활동 시간 등 자동 수집
- **🔍 통합 검색**: 채널과 쓰레드를 동시에 검색하여 최적의 결과 제공
- **🏷️ 스마트 분류**: AI가 자동으로 쓰레드를 카테고리별로 분류
- **💾 효율적 저장**: 복잡한 JOIN 없이 빠른 검색이 가능한 구조

## Project Structure

### `manifest.json`

`manifest.json` is a configuration for Slack apps. With a manifest, you can create an app with a pre-defined configuration, or adjust the configuration of an existing app.

### `app.ts`

`app.ts` is the entry point for the application and is the file you'll run to start the server. This project aims to keep this file as thin as possible, primarily using it as a way to route inbound requests.

### `/listeners`

Every incoming request is routed to a "listener". Inside this directory, we group each listener based on the Slack Platform feature used, so `/listeners/shortcuts` handles incoming [Shortcuts](https://api.slack.com/interactivity/shortcuts) requests, `/listeners/views` handles [View submissions](https://api.slack.com/reference/interaction-payloads/views#view_submission) and so on.

## App Distribution / OAuth

Only implement OAuth if you plan to distribute your application across multiple workspaces. A separate `app-oauth.ts` file can be found with relevant OAuth settings.

When using OAuth, Slack requires a public URL where it can send requests. In this template app, we've used [`ngrok`](https://ngrok.com/download). Checkout [this guide](https://ngrok.com/docs#getting-started-expose) for setting it up.

Start `ngrok` to access the app on an external network and create a redirect URL for OAuth.

```
ngrok http 3000
```

This output should include a forwarding address for `http` and `https` (we'll use `https`). It should look something like the following:

```
Forwarding   https://3cb89939.ngrok.io -> http://localhost:3000
```

Navigate to **OAuth & Permissions** in your app configuration and click **Add a Redirect URL**. The redirect URL should be set to your `ngrok` forwarding address with the `slack/oauth_redirect` path appended. For example:

```
https://3cb89939.ngrok.io/slack/oauth_redirect
```
