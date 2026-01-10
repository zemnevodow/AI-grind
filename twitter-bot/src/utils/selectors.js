/**
 * CSS селекторы для Twitter/X
 * Twitter часто меняет селекторы, поэтому держим их в одном месте
 */

export const SELECTORS = {
  // Логин
  LOGIN: {
    USERNAME_INPUT: 'input[autocomplete="username"]',
    PASSWORD_INPUT: 'input[name="password"]',
    NEXT_BUTTON: '[role="button"]:has-text("Next"), [role="button"]:has-text("Далее")',
    LOGIN_BUTTON: '[data-testid="LoginForm_Login_Button"]',
    // Иногда Twitter просит подтвердить email/phone
    VERIFICATION_INPUT: 'input[data-testid="ocfEnterTextTextInput"]',
  },

  // Лента
  FEED: {
    TIMELINE: '[data-testid="primaryColumn"]',
    TWEET: 'article[data-testid="tweet"]',
    TWEET_TEXT: '[data-testid="tweetText"]',
  },

  // Действия с твитами
  ACTIONS: {
    LIKE: '[data-testid="like"]',
    UNLIKE: '[data-testid="unlike"]',
    RETWEET: '[data-testid="retweet"]',
    REPLY: '[data-testid="reply"]',
    SHARE: '[data-testid="share"]',
  },

  // Комментирование
  COMMENT: {
    TEXTAREA: '[data-testid="tweetTextarea_0"]',
    SUBMIT: '[data-testid="tweetButton"]',
  },

  // Навигация
  NAV: {
    HOME: '[data-testid="AppTabBar_Home_Link"]',
    EXPLORE: '[data-testid="AppTabBar_Explore_Link"]',
    NOTIFICATIONS: '[data-testid="AppTabBar_Notifications_Link"]',
    MESSAGES: '[data-testid="AppTabBar_DirectMessage_Link"]',
  },

  // Профиль и подписки
  PROFILE: {
    FOLLOW_BUTTON: '[data-testid$="-follow"]',
    UNFOLLOW_BUTTON: '[data-testid$="-unfollow"]',
    CONFIRM_UNFOLLOW: '[data-testid="confirmationSheetConfirm"]',
    USER_NAME: '[data-testid="UserName"]',
    USER_DESCRIPTION: '[data-testid="UserDescription"]',
    FOLLOWERS_LINK: 'a[href$="/followers"]',
    FOLLOWING_LINK: 'a[href$="/following"]',
  },

  // Модальные окна
  MODAL: {
    CLOSE: '[data-testid="app-bar-close"]',
    BACK: '[data-testid="app-bar-back"]',
  },

  // Верификация (синяя галочка)
  VERIFIED: {
    BADGE: '[data-testid="icon-verified"]',
    BADGE_SVG: 'svg[aria-label*="Verified"]',
    BADGE_BLUE: 'svg[aria-label="Blue checkmark"]',
  },
};
