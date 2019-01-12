const wc = require('request-promise');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path')

let mail_cookie = "";
let ss_cookie = "";

async function getNewEmail() {
    let response = await wc({
        method: 'GET',
        uri: "https://temp-mail.org/zh/option/refresh/",
        resolveWithFullResponse : true
    })
    let cookie = response.headers["set-cookie"].map(item => item.split(';')[0]).join("; ");
    mail_cookie = cookie;
    let firstBody = cheerio.load(response.body);
    return firstBody("#mail").val();
}

async function refreshCurrentEmailAndGetAuthLinkEmain() {
    let href = undefined;
    while(!href) {
        let response = await wc({
            method: 'GET',
            uri: "https://temp-mail.org/zh/option/refresh/",
            headers: {
                Cookie: mail_cookie
            },
            resolveWithFullResponse : true
        })
        let secondBody = cheerio.load(response.body);
        href = secondBody("#mails > tbody > tr > td:nth-child(1) > a").prop("href");
        if (!href) console.log("还没有拿到注册确认邮件")
        await new Promise((resolve) => {
            setTimeout(() => {
                resolve(href)
            }, 5000)
        })
    }
    return href;
}

async function getRegisterHtmlAndInitSSCookie() {
    let response = await wc({
        method: 'GET',
        uri: "https://www.ali-ss.com/register",
        proxy: "http://127.0.0.1:1080",
        resolveWithFullResponse : true
    })
    let cookie = response.headers["set-cookie"].map(item => item.split(';')[0]).join("; ");
    ss_cookie = cookie;
    let body = cheerio.load(response.body);
    let register_token =  body('body > div.content > form > div:nth-child(1) > input[type="hidden"]:nth-child(3)').val();
    let _token = body('body > div.content > form > div:nth-child(1) > input[type="hidden"]:nth-child(4)').val();
    let aff = body('body > div.content > form > div:nth-child(1) > input[type="hidden"]:nth-child(5)').val();
    return { register_token, _token, aff }
}

async function refreshCaptcha() {
    let base64 = await wc({
        method: 'GET',
        uri: `https://www.ali-ss.com/captcha/default?${Math.random()}`,
        headers: {
            Cookie: ss_cookie
        },
        proxy: "http://127.0.0.1:1080",
        encoding: "base64"
    })
    return base64
}

async function resolveCaptcha(base64) {
    let response = await wc({
        method: 'POST',
        uri: 'http://127.0.0.1:8020/captcha', 
        body: {
            img: base64
        },
        json: true
    });
    return response.code
}

async function register(data) {
    try {
        await wc({
            method: 'POST',
            uri: `https://www.ali-ss.com/register`,
            headers: {
                Cookie: ss_cookie
            },
            formData: data,
            proxy: "http://127.0.0.1:1080"
        })
    } catch (err) {
        if (err.statusCode == 302) {
            return err.response.body.indexOf('login') != -1;
        }
    }
}

async function clickAuthLink(link) {
    let response = await wc({
        method: 'GET',
        uri: link,
        headers: {
            Cookie: mail_cookie
        },
        resolveWithFullResponse : true
    });
    let body = cheerio.load(response.body);
    href = body('body > div.page-content > div > div > div.col-md-7.col-md-offset-0.col-sm-10.col-sm-offset-2.col-xs-12.ord2 > div.content.mainMailViewBl > div.mailView > div.pm-text > div > div > table > tbody > tr > td > center > table:nth-child(2) > tbody > tr > td > table:nth-child(2) > tbody:nth-child(2) > tr > th:nth-child(1) > div > p:nth-child(3) > a').prop("href");
    console.log(`确认注册链接: ${href}`)
    let confirmBody = await wc({
        method: 'GET',
        uri: href,
        headers: {
            Cookie: ss_cookie
        },
        proxy: "http://127.0.0.1:1080"
    });
    if (confirmBody.indexOf("账号激活成功") != -1) {
        console.log("账号激活成功")
    }
}


(async () => {
    let email = await getNewEmail();
    console.log(`email: ${email}`)
    let registerData = await getRegisterHtmlAndInitSSCookie();
    registerData.username = email;
    registerData.password = 'qazwsxedc';
    registerData.repassword = 'qazwsxedc';
    registerData.code = await fs.readFileSync(path.join(__dirname, 'valid_invite_code')).toString();
    let base64Data = await refreshCaptcha();
    await fs.writeFileSync("captcha.png", base64Data, 'base64')
    let captcha = await resolveCaptcha(base64Data);
    registerData.captcha = captcha;
    console.log(`registerData: ${JSON.stringify(registerData)}`);
    let success = await register(registerData);
    while(!success) {
        console.log("验证码错误, 重新获取")
        base64Data = await refreshCaptcha();
        await fs.writeFileSync("captcha.png", base64Data, 'base64')
        let captcha = await resolveCaptcha(base64Data);
        registerData.captcha = captcha;
        success = await register(registerData);
        console.log(`registerData: ${JSON.stringify(registerData)}`);
    }
    let authLinkEmail = await refreshCurrentEmailAndGetAuthLinkEmain();
    await clickAuthLink(authLinkEmail);
    console.log(authLinkEmail)
})()