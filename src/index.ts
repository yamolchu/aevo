const { random } = require('user-agents');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const { Worker, workerData, isMainThread } = require('worker_threads');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const config = require('../inputs/config.ts');
const csvWriter = createCsvWriter({
  path: './result.csv',
  header: [
    { id: 'address', title: 'Address' },
    { id: 'proxy', title: 'Proxy' },
  ],
  append: true,
});

function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
const numThreads = config.numThreads;
const customDelay = config.customDelay;

function parseAddresses(filePath: string) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const addresses: string[] = [];

  lines.forEach((line: string) => {
    const address = line.trim();
    addresses.push(address);
  });

  return addresses;
}
function parseProxies(filePath: string) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const proxies: string[] = [];

  lines.forEach((line: string) => {
    const proxy = line.trim();
    proxies.push(proxy);
  });

  return proxies;
}

const addresses = parseAddresses('./inputs/addresses.txt');
const proxies = parseProxies('./inputs/proxies.txt');

async function reg(address: any, proxy: string) {
  const headers = {
    Host: "api.airtable.com",
    'User-Agent': random().toString(),
    Accept: "application/json, text/plain, */*",
    'Accept-Language': "ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3",
    'Accept-Encoding': "gzip, deflate, br",
    'Content-Type': "application/json",
    'Content-Length': "67",
    'Referer': "https://app.aevo.xyz/",
    'Origin': "https://app.aevo.xyz",
    'Sec-Fetch-Dest': "empty",
    'Sec-Fetch-Mode': "cors",
    'Sec-Fetch-Site': "cross-site",
    'Authorization': "Bearer patR3TZxZ3U5PGKw6.fd05a7be1eb8ee1b6050281036f8ce80e0a2b93de08dbada788a9455c382eeb8",
    'Connection': "keep-alive",
    'TE': "trailers",
  };
  const session = axios.create({
    headers: headers,
    httpsAgent:
      config.proxyType === 'http' ? new HttpsProxyAgent(`http://${proxy}`) : new SocksProxyAgent(`socks5://${proxy}`),
  });

  const data = {"fields":{"Address":address}}
  const res = await session.post('https://api.airtable.com/v0/app2VXAVgYEm9f1uA/Addresses', data);
  console.log(res.data);

  const resultData = [
    {
      address: address,
      proxy: proxy,
    },
  ];
  await csvWriter
    .writeRecords(resultData)
    .then(() => {
      console.log('CSV file has been saved.');
    })
    .catch((error: any) => {
      console.error(error);
    });
}

function regRecursive(addresses: any, proxies: any, index = 0, numThreads = 4) {
  if (index >= addresses.length) {
    return;
  }

  const worker = new Worker(__filename, {
    workerData: { address: addresses[index], proxy: proxies[index] },
  });
  worker.on('message', (message: any) => {
    console.log(message);
  });
  worker.on('error', (error: any) => {
    console.error(error);
  });
  worker.on('exit', (code: any) => {
    if (code !== 0) {
      console.error(`Thread Exit ${code}`);
    }
    regRecursive(addresses, proxies, index + numThreads, numThreads);
  });
}
const main = async () => {
  if (isMainThread) {
    for (let i = 0; i < numThreads; i++) {
      await delay(customDelay);
      regRecursive(addresses, proxies, i, numThreads);
    }
  } else {
    await delay(customDelay);
    const { address, proxy } = workerData;
    reg(address, proxy);
  }
};
main();
