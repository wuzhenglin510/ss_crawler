const wc = require('request-promise');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const sleep = require('sleep');
const log4js = require('log4js');

log4js.configure({
    appenders: { server: { type: 'file', filename: 'server.log' } },
    categories: { default: { appenders: ['server'], level: 'info' } }
  });

const logger = log4js.getLogger('server');

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
        if (!href) logger.info("还没有拿到注册确认邮件")
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
    let response = await wc({
        method: 'GET',
        uri: `https://www.ali-ss.com/captcha/default?${Math.random()}`,
        headers: {
            Cookie: ss_cookie
        },
        proxy: "http://127.0.0.1:1080",
        encoding: "base64",
        resolveWithFullResponse : true
    })
    let cookie = response.headers["set-cookie"].map(item => item.split(';')[0]).join("; ");
    ss_cookie = cookie;
    return response.body
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
    logger.info(`确认注册链接: ${href}`)
    let confirmBody = await wc({
        method: 'GET',
        uri: href,
        headers: {
            Cookie: ss_cookie
        },
        proxy: "http://127.0.0.1:1080"
    });
    if (confirmBody.indexOf("账号激活成功") != -1) {
        logger.info("账号激活成功")
    }
}

async function login(username, password) {
    let response = await wc({
        method: 'GET',
        uri: 'https://www.ali-ss.com/login',
        headers: {
            Cookie: ss_cookie
        },
        proxy: "http://127.0.0.1:1080",
        resolveWithFullResponse : true
    });
    let body = cheerio.load(response.body);
    let _token = body('body > div.content > form > div:nth-child(3) > input[type="hidden"]:nth-child(3)').val();
    base64Data = await refreshCaptcha();
    await fs.writeFileSync("captcha.png", base64Data, 'base64')
    sleep.sleep(2)
    let captcha = await resolveCaptcha(base64Data);
    logger.info(`login captcha: ${captcha}`)
    try {
        await wc({
            method: 'POST',
            uri: `https://www.ali-ss.com/login`,
            headers: {
                Cookie: ss_cookie
            },
            formData: {username, password, _token, captcha},
            proxy: "http://127.0.0.1:1080",
            resolveWithFullResponse : true
        })
    } catch (err) {
        if (err.statusCode == 302 && err.response && err.response.body.indexOf('user') != -1) {
            let cookie = response.headers["set-cookie"].map(item => item.split(';')[0]).join("; ");
            ss_cookie = cookie;
            return true;
        }
        return false
    }
}

async function getNewInviteCode(){
    let response = await wc({
        method: 'GET',
        uri: 'https://www.ali-ss.com/user/invite',
        headers: {
            Cookie: ss_cookie
        },
        proxy: "http://127.0.0.1:1080"
    });
    let _tokenRegex = /var _token = '(.*)'/;
    let _token = _tokenRegex.exec(response)[1];
    await wc({
        method: 'POST',
        uri: `https://www.ali-ss.com/user/makeInvite`,
        headers: {
            Cookie: ss_cookie
        },
        formData: {_token},
        proxy: "http://127.0.0.1:1080",
        resolveWithFullResponse : true
    });
    let newCodeHtml = await wc({
        method: 'GET',
        uri: 'https://www.ali-ss.com/user/invite',
        headers: {
            Cookie: ss_cookie
        },
        proxy: "http://127.0.0.1:1080"
    });
    let body = cheerio.load(newCodeHtml);
    let newCode = body('body > div.page-container > div.page-content-wrapper > div > div:nth-child(2) > div.col-md-8 > div > div > div.portlet-body > div.table-scrollable.table-scrollable-borderless > table > tbody > tr:nth-child(1) > td:nth-child(2) > a').text();
    return newCode;
}

async function getShadowsockServerInfo(){
    let response = await wc({
        method: 'GET',
        uri: 'https://www.ali-ss.com/user',
        headers: {
            Cookie: ss_cookie
        },
        proxy: "http://127.0.0.1:1080"
    });
    let body = cheerio.load(response);
    let code = body('#mt-target-1').val().split('/s/')[1];
    var ssurl= 'https://www.ali-ss.com/s/' + code + "_ss_url";
    let _tokenRegex = /var _token = '(.*)'/;
    let _token = _tokenRegex.exec(response)[1];
    let serverInfoBase64 = await wc({
        method: 'GET',
        uri: ssurl,
        headers: {
            Cookie: ss_cookie
        },
        data: {
            _token
        },
        proxy: "http://127.0.0.1:1080"
    });
    return Buffer.from(serverInfoBase64, 'base64').toString();;
}

async function notify(text){
    let response = await wc({
        method: 'POST',
        uri: 'https://oapi.dingtalk.com/robot/send?access_token=9ad33fd34474837fcf486bb0e889dee42083e55014324f4cac3a3059ed39cca6',
        body: {
            msgtype: "text",
            text: {
                "content": text
            }
        },
        json: true
    });
    let body = cheerio.load(response);
    let serverInfo = body('#mt-target-4').prop('data-clipboard-text')
    return serverInfo;
}

let stepAfterRegister = false;
let registerData = {};
(async () => {
    while(true) {
        try {
            if (!stepAfterRegister) {
                let email = await getNewEmail();
                logger.info(`email: ${email}`)
                registerData = {
                    username: email,
                    password: 'qazwsxedc',
                    repassword: 'qazwsxedc',
                    code: await fs.readFileSync(path.join(__dirname, 'valid_invite_code')).toString()
                }
                let securityData = await getRegisterHtmlAndInitSSCookie();
                registerData.register_token = securityData.register_token;
                registerData._token = securityData._token
                registerData.aff = securityData.aff;
                let base64Data = await refreshCaptcha();
                await fs.writeFileSync("captcha.png", base64Data, 'base64')
                let captcha = await resolveCaptcha(base64Data);
                registerData.captcha = captcha;
                logger.info(`registerData: ${JSON.stringify(registerData)}`)
                sleep.sleep(2)
                let success = await register(registerData);
                while(!success) {
                    logger.info("验证码错误, 重新获取")
                    securityData = await getRegisterHtmlAndInitSSCookie();
                    registerData.register_token = securityData.register_token;
                    registerData._token = securityData._token
                    registerData.aff = securityData.aff;
                    base64Data = await refreshCaptcha();
                    await fs.writeFileSync("captcha.png", base64Data, 'base64')
                    let captcha = await resolveCaptcha(base64Data);
                    registerData.captcha = captcha;
                    logger.info(`registerData: ${JSON.stringify(registerData)}`);
                    sleep.sleep(2)
                    success = await register(registerData);
                }
            }
            stepAfterRegister = true;
            let authLinkEmail = await refreshCurrentEmailAndGetAuthLinkEmain();
            await clickAuthLink(authLinkEmail);
            let loginStat = await login(registerData.username, registerData.password);
            while(!loginStat) {
                sleep.sleep(2)
                loginStat = await login(registerData.username, registerData.password);
            }
            logger.info(`登录成功`);
            let newCode = await getNewInviteCode();
            await fs.writeFileSync(path.join(__dirname, 'valid_invite_code'), newCode);
            logger.info('保存新邀请码成功')
            let serverInfo = await getShadowsockServerInfo();
            logger.info(serverInfo)
            await notify(serverInfo);
        } catch(err) {
            logger.error(err)
            continue;
        }
        stepAfterRegister = false;
        await new Promise((resolve) => {
            setTimeout(() => {
                resolve(href)
            }, 86400000)
        }) 
    }
})()

