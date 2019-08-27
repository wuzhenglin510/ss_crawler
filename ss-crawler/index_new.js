const wc = require('request-promise');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const sleep = require('sleep');
const log4js = require('log4js');

log4js.configure({
   appenders: { server: { type: 'file', filename: 'server.log' }, console: {type: 'console'} },       
   categories: { default: { appenders: ['server', 'console'], level: 'info' } }
});

const logger = log4js.getLogger();

let mail_cookie = "";
let ss_cookie = "";

async function getNewEmail() {
    let response = await wc({
        method: 'GET',
        headers: {
	    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36"
        },
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
                Cookie: mail_cookie,
		"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36"
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
	headers: {
	},
	proxy: "http://111.205.46.29:80",
        uri: "https://1080.cloud/register",
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
        uri: `https://1080.cloud/captcha/default?${Math.random()}`,
        headers: {
            Cookie: ss_cookie
        },
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
            uri: `https://1080.cloud/register`,
            headers: {
                Cookie: ss_cookie
            },
            formData: data,
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
    });
    if (confirmBody.indexOf("账号激活成功") != -1) {
        logger.info("账号激活成功")
    }
}

async function login(username, password) {
    let response = await wc({
        method: 'GET',
        uri: 'https://1080.cloud/login',
        headers: {
            Cookie: ss_cookie
        },
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
            uri: `https://1080.cloud/login`,
            headers: {
                Cookie: ss_cookie
            },
            formData: {username, password, _token, captcha},
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
        uri: 'https://1080.cloud/user/invite',
        headers: {
            Cookie: ss_cookie
        },
    });
    let _tokenRegex = /var _token = '(.*)'/;
    let _token = _tokenRegex.exec(response)[1];
    await wc({
        method: 'POST',
        uri: `https://1080.cloud/user/makeInvite`,
        headers: {
            Cookie: ss_cookie
        },
        formData: {_token},
        resolveWithFullResponse : true
    });
    let newCodeHtml = await wc({
        method: 'GET',
        uri: 'https://1080.cloud/user/invite',
        headers: {
            Cookie: ss_cookie
        },
    });
    let body = cheerio.load(newCodeHtml);
    let newCode = body('body > div.page-container > div.page-content-wrapper > div > div:nth-child(2) > div.col-md-8 > div > div > div.portlet-body > div.table-scrollable.table-scrollable-borderless > table > tbody > tr:nth-child(1) > td:nth-child(2) > a').text();
    return newCode;
}

async function getShadowsockServerInfo(){
    let response = await wc({
        method: 'GET',
        uri: 'https://1080.cloud/user',
        headers: {
            Cookie: ss_cookie
        },
    });
    let body = cheerio.load(response);
    let code = body('#mt-target-1').val().split('/s/')[1];
    var ssurl= 'https://1080.cloud/s/' + code + "_ss_url";
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
    });
    return Buffer.from(serverInfoBase64, 'base64').toString();;
}

async function notify(text){
    await wc({
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
    await wc({
        method: 'POST',
        uri: 'https://oapi.dingtalk.com/robot/send?access_token=8483551aa7900783c0ca8be2f01916e1ccab65651441aed75fe5a583625b055a',
        body: {
            msgtype: "text",
            text: {
                "content": text
            }
        },
        json: true
    });
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
                    code: (await fs.readFileSync(path.join(__dirname, 'valid_invite_code')).toString()).replace('\n', '')
                }
		logger.info(JSON.stringify(registerData))
                let securityData = await getRegisterHtmlAndInitSSCookie();
                registerData.register_token = securityData.register_token;
                registerData._token = securityData._token
                registerData.aff = securityData.aff;
		logger.info("获取验证码")
                let base64Data = await refreshCaptcha();
                await fs.writeFileSync("captcha.png", base64Data, 'base64')
 		logger.info("解析验证码")
                let captcha = await resolveCaptcha(base64Data);
		logger.info(`验证码是:${captcha}`)
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

