// Detect in-app browsers (Line, Facebook, Instagram, etc.) where Web Speech
// API and microphone permissions are unreliable, so we can ask the user to
// open the site in their OS browser instead.

const IN_APP_PATTERNS: { name: string; re: RegExp }[] = [
	{ name: 'Line', re: /\bLine\//i },
	{ name: 'Facebook', re: /\bFBAN\b|\bFBAV\b|\bFB_IAB\b/ },
	{ name: 'Instagram', re: /\bInstagram\b/i },
	{ name: 'Messenger', re: /\bMessenger\b/i },
	{ name: 'WeChat', re: /\bMicroMessenger\b/i },
	{ name: 'TikTok', re: /\bmusical_ly\b|\bBytedanceWebview\b/i },
	{ name: 'KakaoTalk', re: /\bKAKAOTALK\b/i },
	{ name: 'Twitter / X', re: /\bTwitter\b/i },
	{ name: 'Threads', re: /\bThreads\b/i },
	{ name: 'Snapchat', re: /\bSnapchat\b/i },
	{ name: 'Telegram', re: /\bTelegram\b/i },
	{ name: 'WhatsApp', re: /\bWhatsApp\b/i },
	{ name: 'Discord', re: /\bDiscordBot\b|\bDiscord\b/i }
];

export function detectInAppBrowser(ua: string = navigator.userAgent): string | null {
	for (const { name, re } of IN_APP_PATTERNS) {
		if (re.test(ua)) return name;
	}
	return null;
}
