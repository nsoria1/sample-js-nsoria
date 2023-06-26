/* eslint-disable no-bitwise */
/* global OneTrust */
class VisitorId {
  constructor(options) {
    this.preferenceCookieName = 'otpreferences';
    this.optInRequired = VisitorId.isOptInRequired(options?.optInRequired);
  }

  init() {
    this.visitorId = VisitorId.getCookie('visitorid');
    this.domain = VisitorId.getHostWithoutSubdomain();
    this.trackingAllowed = this.performanceTrackingAllowed();

    this.oneTrustIntegration();

    if (!this.visitorId && this.trackingAllowed) {
      this.generateIdAndSetCookie();
    }
  }

  /**
   * Poll for OneTrust global, then set an event listener.
   * Times out after 6 seconds if One Trust is not found.
   */
  oneTrustIntegration() {
    if (typeof OneTrust === 'undefined') {
      const intervalId = setInterval(
        () => {
          if (typeof OneTrust !== 'undefined') {
            OneTrust?.OnConsentChanged(this.handleOneTrustConsentChanged.bind(this));
            clearInterval(intervalId);
          }
        },
        500,
      );

      setTimeout(() => clearInterval(intervalId), 6000);
    } else {
      OneTrust?.OnConsentChanged(this.handleOneTrustConsentChanged.bind(this));
    }
  }

  /**
   * Handle OnConsentChanged event from OneTrust banner.
   *
   * event.detail returns an array of cookie preference codes.
   * C0002 = Performance cookies - visitorid is included in this category.
   *
   * @param {CustomEvent} event    Custom "consent.onetrust" type event from OneTrust.
   */
  handleOneTrustConsentChanged(event) {
    if (event?.detail) {
      // Record preferences in a functional cookie (does not require opt-in).
      this.setCookie(this.preferenceCookieName, event?.detail.join(','));
    }

    if (event?.detail?.includes('C0002') && !this.visitorId) {
      // User is opting in and does not yet have a cookie
      this.generateIdAndSetCookie();
    } else if (!event?.detail?.includes('C0002') && this.visitorId) {
      // User is opting out and has a cookie
      delete this.visitorId;
      this.deleteCookie('visitorid');
    }
  }

  /**
   * Determine whether cookie consent is required.
   *
   * Default to true.
   *
   * @param {boolean} required
   * @returns {boolean}
   */
  static isOptInRequired(required = true) {
    return required !== null ? !!required : true;
  }

  /**
   * If there is no cookie already set,
   * generate an ID and set the cookie.
   */
  generateIdAndSetCookie() {
    this.visitorId = VisitorId.generateVisitorId();
    this.setCookie('visitorid', this.visitorId);
  }

  /**
   * Set the indeed visitorid cookie.
   *
   * @param {string} name         The cookie name.
   * @param {string} visitorid    The cookie value.
   */
  setCookie(name, value) {
    const d = new Date();
    d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
    const expiration = d.toUTCString();
    document.cookie = `${name}=${value}; expires=${expiration}; domain=.${this.domain}; path=/; SameSite=lax; secure`;
  }

  /**
   * Invalidate the indeed visitorid cookie.
   *
   * @param {string} name    The name of the cookie to delete.
   */
  deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; domain=.${this.domain}; path=/; SameSite=lax; secure`;
  }

  /**
   * Checks whether user has consented to or opted out of tracking performance cookies in the past.
   *
   * @returns {boolean}
   */
  performanceTrackingAllowed() {
    const preference = VisitorId.getCookie(this.preferenceCookieName);

    let defaultPreference = false;
    if (typeof preference === 'undefined' && !this.optInRequired) {
      defaultPreference = true;
    }

    return preference?.includes('C0002') ?? defaultPreference;
  }

  /**
   * Get the value of specified cookie.
   *
   * @param {string} name    The cookie to be checked.
   * @returns {string|undefined}    The cookie value.
   */
  static getCookie(name) {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${name}=`));

    const value = cookie ? cookie.split('=')[1] : undefined;

    return value;
  }

  /**
   * A function to generate an ID that closely
   * matches the Indeed common_django function generate_uid.
   *
   * @link https://indeed.sourcegraph.com/code.corp.indeed.com/labs/common-django/-/blob/common_django/utilities/uid_utils.py?L23
   *
   * @returns {number}
   */
  static generateVisitorId() {
    // High
    const msSinceEpoch = new Date().getTime();
    const high = VisitorId.leftPad(msSinceEpoch.toString(32), 9, '0');

    // Mid
    const maxServerId = Math.floor(Math.random() * (2 ** 7)) + (2 ** 15);
    const maxSubServerId = Math.floor(Math.random() * (2 ** 7)) + (2 ** 6);
    const serverId = Math.floor(Math.random() * (maxServerId - (2 ** 15)));
    const subServerId = Math.floor(Math.random() * (maxSubServerId - (2 ** 6)));
    const mid = VisitorId.leftPad(((serverId << 7) | subServerId).toString(32), 4, '0');

    // Low
    const version = 1;
    const maxRandomNum = (2 ** 10);
    const randomNumber = Math.floor(Math.random() * maxRandomNum);
    const low = VisitorId.leftPad(((version << 13) | randomNumber).toString(32), 3, '0');

    return high + mid + low;
  }

  /**
   * A helper function to append a character to the beginning of a string
   * until it reaches a specified length.
   *
   * @param {string} str        Original string.
   * @param {number} length     Desired string length.
   * @param {string} padChar    Character to append.
   *
   * @returns {string}
   */
  static leftPad(str, length, padChar) {
    let newStr = str;
    while (newStr.length < length) {
      newStr = padChar + newStr;
    }
    return newStr;
  }

  /**
   * Get the current page's URL host without the leading subdomain.
   */
  static getHostWithoutSubdomain() {
    const { host } = window.location;
    const parts = host.split('.');
    const index = host.includes('.wpengine.') ? -3 : -2;

    return parts.slice(index).join('.');
  }
}

//export default VisitorId;
//window.VisitorId = VisitorId;
