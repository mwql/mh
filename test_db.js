
const https = require('https');

const SB_URL = 'https://jfmvebvwovibxuxskrcd.supabase.co';
const SB_KEY = 'sb_publishable_YSsIGJW7AQuh37VqbwmDWg_fmRZVXVh';

function request(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SB_URL.replace('https://', '').replace(/\/$/, ''),
            path: '/rest/v1' + path,
            method: method,
            headers: {
                'apikey': SB_KEY,
                'Authorization': `Bearer ${SB_KEY}`,
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
        });

        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function test() {
    console.log('--- TEST START ---');

    console.log('1. Testing POST (Insert Log)...');
    const payload = JSON.stringify({
        condition: '__VIEW_LOG__',
        notes: '{"test":true}',
        date: '2025-01-01',
        temperature: '0'
    });
    
    // Test INSERT
    const postRes = await request('POST', '/predictions', {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation' 
    }, payload);
    
    console.log('POST Status:', postRes.statusCode);
    if (postRes.statusCode >= 200 && postRes.statusCode < 300) {
        console.log('POST Success:', postRes.body);
    } else {
        console.error('POST Failed:', postRes.body);
    }

    console.log('\n2. Testing HEAD (Count Logs)...');
    const headRes = await request('HEAD', '/predictions?condition=eq.__VIEW_LOG__', {
        'Prefer': 'count=exact'
    });
    
    console.log('HEAD Status:', headRes.statusCode);
    console.log('Content-Range:', headRes.headers['content-range']);
    
    console.log('--- TEST END ---');
}

test();
