import { getStorage, setStorage } from '../lib/storage';

const sensitivity = document.getElementById('sensitivity');
const userKeywords = document.getElementById('userKeywords');
const whitelist = document.getElementById('whitelist');
const saveBtn = document.getElementById('saveBtn');
const status = document.getElementById('status');

async function loadSettings() {
  const data = await getStorage();

  sensitivity.value = data.settings.sensitivity;
  userKeywords.value = data.lists.userKeywords.join('\n');
  whitelist.value = data.lists.whitelist.join('\n');
}

function isValidDomain(domain) {
  // Basic domain validation - allows subdomains and TLDs
  return /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(domain);
}

function isValidKeyword(keyword) {
  // Keywords should be alphanumeric with spaces, no special regex chars
  return /^[a-zA-Z0-9\s\-']+$/.test(keyword) && keyword.length <= 100;
}

async function saveSettings() {
  const data = await getStorage();

  data.settings.sensitivity = sensitivity.value;

  const keywords = userKeywords.value
    .split('\n')
    .map((k) => k.trim())
    .filter((k) => k !== '');

  const invalidKeywords = keywords.filter((k) => !isValidKeyword(k));
  if (invalidKeywords.length > 0) {
    status.textContent = 'Invalid keywords: ' + invalidKeywords.join(', ');
    status.style.color = '#f44336';
    status.style.display = 'inline';
    setTimeout(() => {
      status.style.display = 'none';
      status.style.color = '';
      status.textContent = 'Saved!';
    }, 3000);
    return;
  }
  data.lists.userKeywords = keywords;

  const domains = whitelist.value
    .split('\n')
    .map((d) => d.trim())
    .filter((d) => d !== '');

  const invalidDomains = domains.filter((d) => !isValidDomain(d));
  if (invalidDomains.length > 0) {
    status.textContent = 'Invalid domains: ' + invalidDomains.join(', ');
    status.style.color = '#f44336';
    status.style.display = 'inline';
    setTimeout(() => {
      status.style.display = 'none';
      status.style.color = '';
      status.textContent = 'Saved!';
    }, 3000);
    return;
  }
  data.lists.whitelist = domains;

  await setStorage(data);

  // Show status
  status.style.display = 'inline';
  setTimeout(() => {
    status.style.display = 'none';
  }, 2000);
}

document.addEventListener('DOMContentLoaded', loadSettings);
saveBtn.addEventListener('click', saveSettings);
