import * as request from "request-promise-native"
import { resolve } from "url"
import { load as cheerio } from "cheerio"

const baseUrl = "https://duwo.multiposs.nl/"
const sessionUrlRegExp = /^\s*document\.location = '(.+)';\s*$/miu
const qrIdRegExp = /^\s*"text": "(.+)"\s*$/miu

export default class Multiposs {
  constructor(
    private readonly _username: string,
    private readonly _password: string
  ) { }


  private _request = request.defaults({
    baseUrl,
    followRedirect: true,
    jar: true
  })

  private _loggedIn?: Promise<boolean>
  get loggedIn() {
    if (!this._loggedIn) this._loggedIn = this.refreshLogin()
    return this._loggedIn
  }

  private async refreshLogin() {
    const loginUrl = "/login/submit.php"
    const loginBody: string = await this._request.post(loginUrl, {
      form: {
        UserInput: this._username,
        PwdInput: this._password
      }
    })

    const sessionUrlMatches = sessionUrlRegExp.exec(loginBody)
    if (!sessionUrlMatches) throw new Error("Can't find start session url")
    const sessionUrl = resolve(loginUrl, sessionUrlMatches[1])

    const mainPage: string = await this._request(sessionUrl)
    process.nextTick(() => this._refreshBalance(mainPage))

    return this._loggedIn = Promise.resolve(true)
  }

  private _balance?: Promise<number>
  get balance() {
    if (!this._balance) this._balance = this.refreshBalance()
    return this._balance
  }

  async refreshBalance() {
    await this.loggedIn
    const body: string = await this._request("/main.php")
    return this._refreshBalance(body)
  }

  private async _refreshBalance(body: string) {
    const $ = cheerio(body)
    const balanceString = $("#LblUserCredits").text()
    const sanitizedBalanceString = balanceString.trim().replace(",", "")
    return this._balance = Promise.resolve(parseInt(sanitizedBalanceString))
  }

  private _qrId?: Promise<string>
  get qrId() {
    if (!this._qrId) this._qrId = this.refreshQrId()
    return this._qrId
  }

  async refreshQrId() {
    await this.loggedIn
    const body: string = await this._request("/GenUserQrcode.php")
    const qrIdMatches = qrIdRegExp.exec(body)
    if (!qrIdMatches) throw new Error("Can't find QR id")
    return this._qrId = Promise.resolve(qrIdMatches[1])
  }


}
