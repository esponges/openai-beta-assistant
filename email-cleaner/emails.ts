const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

// IMPORTANT: Use the google docs tutorial to create and access to your gmail account
// follow step by step the authorization process or it will not work
// https://developers.google.com/gmail/api/quickstart/nodejs

// this gives ALL permissions to the app - USE WITH CAUTION
// app should be configured before running this script in the OAuth consent screen -> Scopes for Google APIs
// If modifying these scopes, delete token.json.
const SCOPES = ['https://mail.google.com/'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'email-cleaner/credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.labels.list({
    userId: 'me',
  });
  const labels = res.data.labels;
  if (!labels || labels.length === 0) {
    console.log('No labels found.');
    return;
  }

  return labels.map((label) => {
    console.log(`- ${label.name}`);
    return label;
  });
}

/**
 * Gets the message details in the user's account.
 * @param {nubmer} id The id of the message.
 * @return {Promise<object>}
 */
async function getMessage(auth, id) {
  const gmail = google.gmail({ version: 'v1', auth });
  return gmail.users.messages.get({
    userId: 'me',
    id,
  });
}

/**
 * Deletes the message in the user's account.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {nubmer} id The id of the message.
 * @return {Promise<object>}
 */

async function deleteMessages(auth, ids: number | number[]) {
  const gmail = google.gmail({ version: 'v1', auth });

  if (Array.isArray(ids)) {
    return gmail.users.messages.batchDelete({
      userId: 'me',
      ids,
    });
  }

  return gmail.users.messages.delete({
    userId: 'me',
    id: ids,
  });
}

/**
 * Lists the messages in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listMessages(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 10,
  });
  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    console.log('No messages found.');
    return;
  }
  let messagesWithDetails = [];
  for await (const message of messages) {
    // get message data
    const res = await getMessage(auth, message.id);
    messagesWithDetails.push({ id: message.id, snippet: res.data.snippet });
  }

  return messagesWithDetails;
}

/**
 * Lists unread messages in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listUnreadMessages(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 5,
    q: 'is:unread',
  });
  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    console.log('No messages found.');
    return;
  }

  let messagesWithDetails = [];
  for await (const message of messages) {
    // get message data
    const res = await getMessage(auth, message.id);
    messagesWithDetails.push({ id: message.id, snippet: res.data.snippet });
  }
  console.log(messagesWithDetails);

  // delete first message
  const del = await deleteMessages(auth, messagesWithDetails[0].id);

  return messagesWithDetails;
}

// authorize().then(listLabels).catch(console.error);
// authorize().then(listMessages).catch(console.error);
authorize().then(listUnreadMessages).catch(console.error);

export {};
