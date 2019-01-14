语言 nodejs + python

这是一个 爬虫 + 深度学习 的项目
每天使用一个临时邮箱去shadowsocks服务提供商的网站上注册一个账号。新账号有两天免费的流量。然后发送到钉钉群

因为该网站注册和登录都需要验证码， 为了全自动，又不想调用一些验证码识别服务提供商的接口， 因为要钱。
所以就写了一个 基于 CNN 卷积神经网络的子项目， 完成验证码的识别。

下面是代码运行日志
```
[2019-01-13T19:49:20.469] [INFO] server - 获取临时邮箱: ducuki@2mailnext.com
[2019-01-13T19:49:21.001] [INFO] server - 打开注册页面获取表单CSRF_Token
[2019-01-13T19:49:22.301] [INFO] server - 获取验证码图片
[2019-01-13T19:49:22.301] [INFO] server - 识别验证码图片
[2019-01-13T19:49:23.801] [INFO] server - 注册信息: {"username":"ducuki@2mailnext.com","password":"******","repassword":"******","code":"608F32ED39B9","register_token":"XE5ZGuwEVYaChE35","_token":"pTrLuOeWZppIIAVsXy5t9AIEHEJ3XujefVmB6SLZ","aff":"","captcha":"ztt4"}
[2019-01-13T19:49:23.801] [INFO] server - 提交注册表单
[2019-01-13T19:49:24.312] [INFO] server - 验证码错误, 重新获取验证码图片
[2019-01-13T19:49:24.901] [INFO] server - 识别验证码图片
[2019-01-13T19:49:25.285] [INFO] server - 注册信息: {"username":"ducuki@2mailnext.com","password":"******","repassword":"******","code":"608F32ED39B9","register_token":"DXat8FpdB87TTZMZ","_token":"K0UpOYVuCtD9xfchObjg0Gi3JmUf0YKdo6gBTDny","aff":"","captcha":"qrj8"}
[2019-01-13T19:49:26.285] [INFO] server - 提交注册表单
[2019-01-13T19:49:26.285] [INFO] server - 注册成功
[2019-01-13T19:49:32.185] [INFO] server - 临时邮箱还没有拿到注册确认邮件, 5秒后再次确认
[2019-01-13T19:49:37.185] [INFO] server - 临时邮箱拿到注册确认邮件
[2019-01-13T19:49:38.104] [INFO] server - 确认注册链接: https://www.ali-ss.com/active/b1858775ac7de9e3449594511d1243e0
[2019-01-13T19:49:39.501] [INFO] server - 账号激活成功
[2019-01-13T19:49:40.434] [INFO] server - 获取登录验证码
[2019-01-13T19:49:41.434] [INFO] server - 识别登录验证码: x4x6
[2019-01-13T19:49:42.975] [INFO] server - 登录成功
[2019-01-13T19:49:43.155] [INFO] server - 保存新邀请码成功
[2019-01-13T19:49:43.555] [INFO] server - 提取服务节点信息
[2019-01-13T19:49:44.512] [INFO] server - ss://Y2hhY2hhMjA6MTIzQHd3dy4xMDgwLmNsb3VkOjQ0Mw#【账号】有效期至：2019-01-15，流量剩余：1.95 GBGB
ss://eGNoYWNoYTIwLWlldGYtcG9seTEzMDU6NWI1czRtQDEwNi4xNC4xNzguNTc6NTM0MTA#【1080】上海
ss://eGNoYWNoYTIwLWlldGYtcG9seTEzMDU6NWI1czRtQHNoMDIuYXBuaWNwcm8uY246NTM0MTA#【1080】上海02
ss://eGNoYWNoYTIwLWlldGYtcG9seTEzMDU6NWI1czRtQHJ1LTAxLnlmYW4ub25saW5lOjUzNDEw#【1080】俄罗斯01
ss://eGNoYWNoYTIwLWlldGYtcG9seTEzMDU6NWI1czRtQDE3OC4xMjguODEuMTc0OjUzNDEw#【1080】新加坡01
ss://eGNoYWNoYTIwLWlldGYtcG9seTEzMDU6NWI1czRtQGpwLTAxLmFwbmljcHJvLmNuOjUzNDEw#【1080】日本01
ss://eGNoYWNoYTIwLWlldGYtcG9seTEzMDU6NWI1czRtQGpwLTAzLmFsaS1zcy54eXo6NTM0MTA#【1080】日本03

```
大概就这样
