#!/usr/bin/env python3
"""Generates Parley's info pages, blog, llms.txt, sitemap and robots from the content below.
Run: python3 tools/build-pages.py   (from the repo root). Static output, no build step on Vercel."""
import json, os, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://getparley.vercel.app'
TODAY = datetime.date.today().isoformat()

HEAD = '''<!doctype html>
<html lang="en" data-palette="night">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#050505">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="{ogtype}">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="Parley">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="shortcut icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<script>try{{var p=JSON.parse(localStorage.getItem("parley.prefs.v1")||"{{}}").palette;document.documentElement.setAttribute("data-palette",p||"night")}}catch(e){{}}</script>
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/landing.css">
<link rel="stylesheet" href="/pages.css">
<script type="application/ld+json">{ld}</script>
</head>
<body class="landing doc">
<header class="site-head scrolled">
  <a class="brand" href="/"><span class="brand-mark"></span><span>Parley</span></a>
  <nav class="site-nav" aria-label="Site">
    <a href="/how-it-works">How it works</a>
    <a href="/compare">Compare</a>
    <a href="/faq">FAQ</a>
    <a href="/blog/">Blog</a>
  </nav>
  <a class="btn btn-volt head-cta" href="/app">Open Parley</a>
</header>
<main>
'''
FOOT = '''
</main>
<footer class="site-foot">
  <div>
    <span class="brand"><span class="brand-mark"></span><span>Parley</span></span>
    <nav aria-label="Pages">
      <a href="/">Home</a><a href="/app">Open the app</a><a href="/how-it-works">How it works</a><a href="/compare">Parley vs Google Translate vs Apple Translate</a><a href="/faq">FAQ</a><a href="/blog/">Blog</a><a href="/llms.txt">llms.txt</a><a href="https://github.com/EliCrossDev/parley">Source on GitHub</a>
    </nav>
    <p class="mono" style="margin-top:14px">Speech by your browser · Translation by open engines · Your data stays on your device · Made by 0xROSSI Digital</p>
  </div>
</footer>
</body>
</html>
'''
RELATED = '''<div class="related"><p><b>Keep reading:</b> <a href="/how-it-works">How Parley works</a> · <a href="/compare">Parley vs Google Translate vs Apple Translate</a> · <a href="/faq">Frequently asked questions</a> · <a href="/blog/">All posts</a> · <a href="/app">Open Parley, it's free</a></p></div>'''

ORG = {"@type": "Organization", "name": "0xROSSI Digital", "url": SITE}
APP_LD = {
    "@context": "https://schema.org", "@type": "SoftwareApplication", "name": "Parley",
    "url": SITE, "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any (web browser: Chrome, Safari, Edge; installable on iOS, Android, macOS, Windows)",
    "description": "Parley is a free live conversation translator for two people in the same room. Pick two languages, put the phone between you, and each person sees what the other said in their own language as they say it. Automatic detection of which language is being spoken, optional spoken playback, conversations saved on your device.",
    "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD", "description": "Free. Optional pay-what-you-want supporter upgrade for unlimited history and export."},
    "featureList": ["Live two-way conversation translation", "Automatic detection of which of the two languages is being spoken", "28 languages", "Spoken playback of translations", "Conversations and audio saved on device", "Installable web app (PWA), no app store", "No account required"],
    "author": ORG, "publisher": ORG, "isAccessibleForFree": True, "inLanguage": "en",
}

def page(path, title, desc, body, ld=None, ogtype='website'):
    url = SITE + path
    ld = ld or {"@context": "https://schema.org", "@type": "WebPage", "name": title, "description": desc, "url": url, "isPartOf": {"@type": "WebSite", "name": "Parley", "url": SITE}, "publisher": ORG}
    html = HEAD.format(title=title, desc=desc, url=url, ogtype=ogtype, ld=json.dumps(ld, ensure_ascii=False)) + body + FOOT
    out = os.path.join(ROOT, path.strip('/') + ('/index.html' if path.endswith('/') else '.html'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w').write(html)
    return url

urls = []

# ---------------------------------------------------------------- How it works
urls.append(page('/how-it-works', 'How Parley works: live conversation translation in the browser',
 'How Parley translates an in-person conversation live: speech recognition in the browser, detection of which language is being spoken from the first two words, translation as the words land, and spoken playback with open-source voices.',
 '''<article>
<p class="eyebrow">How it works</p>
<h1>Live conversation translation, explained simply.</h1>
<p class="lede">Parley is a web app for two people who do not share a language and are standing in the same place. There is no call, no account and nothing to download from an app store. Here is what happens underneath.</p>
<h2>1. Two languages, one screen</h2>
<p>You pick the two languages in the room, for example English and Spanish. It does not matter who is who. Put the phone between you and tap Start. Light bubbles are one language, dark bubbles are the other, large enough to read across a table.</p>
<h2>2. Speech is recognized by your browser</h2>
<p>Parley uses the speech recognition built into Chrome, Edge and Safari. Nothing is uploaded to a Parley server, because there is no Parley server in the loop: the browser hears you and hands Parley the words as you say them, with interim results arriving several times a second.</p>
<h2>3. Parley decides who is talking from the first two words</h2>
<p>The browser's engine can only listen in one language at a time, so Parley has to know which language is being spoken as early as possible. It checks the first two words against a tiny on-device list of the most common words in each language (articles, pronouns, greetings). For languages that use different alphabets it looks at the script instead. When that is not enough, it asks the translation engine to identify the language. If the guess was wrong, Parley switches the recognizer and keeps the words it already heard. Either person can also tap their language chip to force it.</p>
<h2>4. Translation appears as the sentence is still being said</h2>
<p>Every fraction of a second, the in-progress sentence is translated and shown in the big text of the bubble while the raw words stay in the small line above it. When the room goes quiet, Parley commits the line, translates the final version, and switches the engine to the other language during that silence, so the reply is heard in the right language.</p>
<h2>5. Optional voice</h2>
<p>Turn on "Read translations out loud" and Parley speaks the translation with Kokoro, an open-source neural voice model that downloads to your device once and then runs offline. There is no per-use cost, which is part of why Parley is free.</p>
<h2>6. Everything stays on your device</h2>
<p>Transcripts and audio recordings are stored in your browser's own database, grouped by day, and can be replayed bubble by bubble. The free tier keeps your last five conversations; <a href="/faq#supporter">supporters</a> keep all of them and can export transcripts.</p>
<p><a class="cta" href="/app">Try it now, it's free</a></p>
''' + RELATED + '</article>'))

# ---------------------------------------------------------------- Compare
urls.append(page('/compare', 'Parley vs Google Translate vs Apple Translate for live in-person conversation',
 'An honest comparison of Parley with Google Translate conversation mode and Apple Translate conversation mode for translating a face-to-face conversation: install, cost, language detection, privacy, playback and history.',
 '''<article>
<p class="eyebrow">Comparison</p>
<h1>Parley vs Google Translate vs Apple Translate</h1>
<p class="lede">All three can translate a conversation between two people in the same room. They differ in where they run, what they keep, and how they decide who is speaking. This page is written by the Parley team, so read it with that in mind; where we are unsure how a competitor behaves today, we say so.</p>
<div class="table-wrap"><table>
<tr><th>Capability</th><th>Parley</th><th>Google Translate (Conversation)</th><th>Apple Translate (Conversation)</th></tr>
<tr><td>Where it runs</td><td>Any modern browser; installs to the home screen as a web app</td><td>Google Translate app (iOS, Android)</td><td>Translate app built into iOS and iPadOS</td></tr>
<tr><td>Account or store</td><td>None. Open the link and talk</td><td>App Store or Play Store download</td><td>Pre-installed on iPhone</td></tr>
<tr><td>Cost</td><td>Free. Optional pay-what-you-want supporter upgrade</td><td>Free</td><td>Free</td></tr>
<tr><td>Who is speaking</td><td>Detected from the first two words; tap a chip to override</td><td>Automatic detection between the two chosen languages</td><td>Automatic detection between the two chosen languages</td></tr>
<tr><td>Translation shown while the sentence is still being said</td><td>Yes, interim translation updates in the bubble</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Spoken playback</td><td>Optional, open-source neural voices that run on the device</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Saves the conversation</td><td>Transcript and audio, replayable bubble by bubble, on the device</td><td>History of translations, tied to your Google account when signed in</td><td>Favorites and recent translations</td></tr>
<tr><td>Where your words go</td><td>Browser speech engine and public translation engines; no Parley server sees your conversation</td><td>Google servers</td><td>Apple; on-device mode available when languages are downloaded</td></tr>
<tr><td>Languages</td><td>28, chosen for real conversations</td><td>Over 100</td><td>About 20</td></tr>
<tr><td>Works on a laptop or desktop</td><td>Yes, same link</td><td>Web version lacks conversation mode</td><td>Mac Translate app</td></tr>
<tr><td>Pick your own translation engine</td><td>Yes: public engines or your own LibreTranslate server</td><td>No</td><td>No</td></tr>
</table></div>
<h2>When Parley is the better pick</h2>
<p>You want something that opens instantly on any phone or laptop with nothing to install, you care that no account is involved, you want to replay the conversation later with the audio, or you want to point the translator at your own server for private, unlimited use. Parley's whole screen is the conversation, with nothing else competing for attention.</p>
<h2>When the big apps are the better pick</h2>
<p>You need one of the many languages Parley does not cover yet, you want fully offline translation with downloaded language packs, or you already live inside the Google or Apple ecosystem and want history synced to your account. Google Translate also handles text in photos and documents, which Parley does not try to do.</p>
<h2>How the detection actually differs</h2>
<p>The browser speech engines Parley relies on can only listen in one language per session. Parley works around that by guessing from the first two words and switching during silences, which we explain in <a href="/how-it-works">How it works</a>. The native apps run their own speech models and identify the language from the audio itself. In practice both approaches feel immediate; the native apps have the edge when both languages sound alike and the first words are ambiguous, and Parley has the edge in getting started and in keeping your words off a company server.</p>
<p><a class="cta" href="/app">Open Parley</a></p>
''' + RELATED + '</article>'))

# ---------------------------------------------------------------- FAQ
FAQ = [
 ("Is Parley really free?", "Yes. Live translation, all 28 languages, spoken playback and your last five saved conversations are free with no account. If Parley is useful you can chip in whatever you want, one time, and get unlimited history, recordings kept until you delete them, and transcript export."),
 ("Do I need to download an app?", "No. Parley runs in Chrome, Edge or Safari. You can add it to your home screen from the browser and it then opens full screen with its own icon, like any app. On Android and desktop Chrome the Install button does this for you; on iPhone tap Share, then Add to Home Screen."),
 ("How does Parley know which language is being spoken?", "It reads the first two words. A small on-device list of the most common words in each language usually settles it instantly; for languages with different alphabets the script alone is enough; otherwise the translation engine identifies the language. If Parley guesses wrong, it switches and keeps what it heard, and either person can tap their language chip to force it."),
 ("Is there a delay?", "The translation starts appearing while the sentence is still being said and is finalized about a second after you stop talking. The engine switches languages during that silence so the other person's reply is heard correctly."),
 ("Where do my conversations go?", "They stay on your device. Transcripts and audio are stored in your browser's local database. There is no Parley account and no Parley server that sees your conversation. Speech recognition is done by your browser's engine and translation by public translation engines, or by your own LibreTranslate server if you set one up."),
 ("Which languages does Parley support?", "28 at the moment: English, Spanish, Portuguese, Chinese, Hindi, Thai, Korean, Japanese, French, German, Italian, Arabic, Russian, Indonesian, Vietnamese, Turkish, Dutch, Polish, Filipino, Swahili, Bengali, Urdu, Hebrew, Greek, Swedish, Ukrainian, Malay and Persian."),
 ("Does Parley work offline?", "Not yet. Parley needs an internet connection for two things: the browser's speech recognition and the translation itself. Cellular data is fine and the amount used is small, about the same as a voice note. Spoken playback does work offline once the voice has downloaded. Fully offline translation would mean running the speech and translation models on the phone, which is on the roadmap for newer phones."),
 ("Does Parley work on a laptop?", "Yes, the same link works on macOS, Windows and Linux in Chrome or Edge, and in Safari on a Mac. It is handy for a desk conversation or a video call where the other person is in the room with you."),
 ("Can it speak the translation out loud?", "Yes. Turn on Read translations out loud. Voices come from Kokoro, an open-source neural text-to-speech model that downloads once and runs on your device."),
 ("How is Parley different from Google Translate or Apple Translate?", "Nothing to install, no account, the whole screen is the conversation, conversations replay with audio, and you can use your own translation server. The native apps cover more languages and can work fully offline. See the full comparison page."),
 ("What do supporters get?", "Unlimited conversation history instead of the last five, recordings kept until you delete them, transcript export, and a Keep setting to auto-trim history to any number you choose. It is pay what you want, one time, and the same email unlocks any other device."),
 ("Is Parley open source?", "The source is on GitHub. Underneath, Parley relies on open projects and credits them: Kokoro for voices, LibreTranslate and Argos Translate for self-hosted translation, and the ideas in Handy and whisper.cpp."),
 ("Who makes Parley?", "Parley is made by 0xROSSI Digital, an independent studio run by Frankie Rossi."),
]
faq_body = ['<article><p class="eyebrow">FAQ</p><h1>Questions people ask about Parley</h1>']
for q, a in FAQ:
    anchor = 'supporter' if q.startswith('What do supporters') else ''
    faq_body.append(f'<h2{" id=\"supporter\"" if anchor else ""}>{q}</h2><p>{a}</p>')
faq_body.append(RELATED + '</article>')
faq_ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}
urls.append(page('/faq', 'Parley FAQ: free live conversation translator, questions answered',
 'Answers about Parley, the free live translation app for in-person conversations: cost, installing on iPhone and Android, how language detection works, latency, privacy, supported languages and the supporter upgrade.',
 '\n'.join(faq_body), ld=faq_ld))

# ---------------------------------------------------------------- Blog
POSTS = [
 ('live-conversation-translation-in-the-browser', '2026-10-20', 'Why we built a live conversation translator that runs in the browser',
  'The case for a translation tool with no app store, no account and no server in the loop, and what that makes possible for two people standing in the same room.',
  '''<p class="lede">Most translation apps were designed around a text box. Parley was designed around two people, a table, and a phone lying between them.</p>
<h2>The moment we wanted to fix</h2>
<p>You are at a market, a clinic, a landlord's office, a dinner. The other person does not speak your language. Both of you reach for a phone, open an app, tap through screens, hold it up, wait. The conversation that was supposed to happen has become a demo of an app.</p>
<p>We wanted the opposite: one link, one screen, both of you looking at the same bubbles, no account, nothing to set up beyond picking two languages. The whole app is the conversation.</p>
<h2>Why the browser</h2>
<p>Chrome and Safari already ship excellent speech recognition, and open translation engines are a request away. By building Parley as a web app we skip the store, work on every phone and laptop with one link, and keep your words off our servers because there are no servers of ours in the loop. It also means Parley can be installed to the home screen and run full screen, like an app, in two taps.</p>
<h2>What it cost us</h2>
<p>Browser speech engines only listen in one language at a time. A native app with its own speech model can identify the language from the sound; we cannot. So we built a different approach: decide from the first two words, switch during silences, never mid-word. We wrote about it in <a href="/blog/how-parley-knows-which-language-is-being-spoken">How Parley knows which language is being spoken</a>.</p>
<h2>What it made possible</h2>
<p>Free for everyone, because nothing meters. Private by construction. Replayable conversations, with audio, on your device. And a translation engine you can swap for your own server when you need unlimited, private use. Try it at <a href="/app">getparley.vercel.app/app</a>.</p>'''),
 ('how-parley-knows-which-language-is-being-spoken', '2026-10-27', 'How Parley knows which language is being spoken',
  'A look inside Parley\'s two-word language detection: on-device word lists, script detection, a translator fallback, and switching the speech engine only during silence.',
  '''<p class="lede">The browser can only hear one language at a time. Here is how Parley turns that into a conversation that flips direction on its own.</p>
<h2>The constraint</h2>
<p>Web speech recognition takes a language code when it starts. Start it in English and Spanish comes out as nonsense. So the question Parley has to answer, every time someone starts talking, is: which of the two languages is this, and how fast can we know?</p>
<h2>Two words</h2>
<p>The first thing Parley does with an in-progress sentence is look at its first two words. For the common pairs that share an alphabet, like English and Spanish or Portuguese and Italian, a small list of each language's most frequent function words (the, a, is, yes; el, la, es, sí) usually decides it in zero milliseconds, on the device. For pairs with different scripts, Japanese and English for instance, the characters themselves answer the question.</p>
<p>If neither trick is confident, Parley sends just those two words to the translation engine and asks it which language they are. That costs one short network round trip and happens while the person is still talking.</p>
<h2>Switching without losing words</h2>
<p>When the guess says the other person is talking, Parley restarts the speech engine in their language and carries the words it already heard into the new bubble. When a line ends in silence, Parley commits it, translates it, and uses that same silence to switch the engine to the other language, because the reply usually comes next. If the same person keeps talking instead, the two-word check flips it back.</p>
<h2>A manual override, always</h2>
<p>Automatic detection is a guess, and guesses are wrong sometimes. Both language chips at the bottom of the live screen are buttons; tapping one tells Parley who is speaking right now. It is the fastest fix there is and it never gets in the way when the guess is right.</p>
<p>Read how the rest of the pipeline fits together in <a href="/how-it-works">How Parley works</a>.</p>'''),
 ('install-parley-iphone-android-desktop', '2026-11-01', 'Install Parley on iPhone, Android or your desktop in two taps',
  'Parley is an installable web app. Here is how to put it on your home screen on iPhone and Android, and on your desktop in Chrome or Edge, with no app store involved.',
  '''<p class="lede">Parley lives at one link. Installing it just means giving that link an icon and a full-screen window.</p>
<h2>iPhone and iPad</h2>
<p>Open <a href="/app">getparley.vercel.app/app</a> in Safari. Tap the Share button, then "Add to Home Screen", then Add. Parley now opens full screen from its own icon. The first time you start a conversation, allow the microphone.</p>
<h2>Android</h2>
<p>Open the same link in Chrome. Tap "Install on your phone" on the home page, or use the browser menu and choose "Install app". Chrome puts Parley in your app drawer and on the home screen.</p>
<h2>Mac, Windows and Linux</h2>
<p>In Chrome or Edge, open the link and click the install icon at the right end of the address bar, or use the "Install on your phone" button on the home page, which installs on desktop too. Parley opens in its own window, which is handy on a desk when someone is sitting across from you.</p>
<h2>Why not an app store?</h2>
<p>Because you should not need an account, a download, or an update prompt to have a conversation. Installing from the browser gives you the icon and the full-screen experience with none of that, and updates arrive automatically the next time you open it.</p>'''),
 ('why-parley-is-free-and-what-supporters-get', '2026-11-02', 'Why Parley is free, and what supporters get',
  'Parley costs nothing to run per conversation, so it is free for everyone. Supporters chip in whatever they want, once, and get unlimited history, kept recordings and transcript export.',
  '''<p class="lede">There is no meter running when you use Parley, so there is nothing to charge you for. Here is the honest economics.</p>
<h2>Nothing meters</h2>
<p>Speech recognition is done by your browser. Translation comes from public engines. Voices are an open-source model that runs on your device. Conversations are stored on your device. The only infrastructure is static hosting and a tiny payment endpoint. That is why the free tier is the whole product: unlimited live translation, every language, spoken playback, your last five conversations saved.</p>
<h2>Pay what you want, once</h2>
<p>If Parley earns a place in your pocket, you can chip in whatever amount you choose, one time, no subscription. Supporters keep every conversation instead of the last five, keep audio recordings until they delete them, can export transcripts, and get a Keep setting that auto-trims history to any number they like. The email you paid with unlocks any other device.</p>
<h2>What we will never do</h2>
<p>Sell your conversations, because we never see them. Add an account wall. Put live translation behind a paywall.</p>
<p>Questions? See the <a href="/faq">FAQ</a> or just <a href="/app">open Parley</a>.</p>'''),
 ('parley-vs-google-translate-conversation-mode', '2026-11-03', 'Parley vs Google Translate conversation mode: which one for a face-to-face chat?',
  'A practical, first-party comparison of Parley and Google Translate\'s conversation mode for translating an in-person conversation: setup, detection, privacy, history and when to pick each.',
  '''<p class="lede">Google Translate's conversation mode is good. Here is where Parley does better, where it does not, and how to decide in ten seconds.</p>
<h2>Getting started</h2>
<p>Parley: open a link, pick two languages, tap Start. Google Translate: install the app, sign in or skip, choose Conversation, pick languages. Both are quick; Parley wins when the other person's phone is the one you are using, because there is nothing to install.</p>
<h2>Detecting who is talking</h2>
<p>Google's app listens for both languages at once with its own speech models. Parley decides from the first two words and switches the browser's engine during silences, which we describe in <a href="/blog/how-parley-knows-which-language-is-being-spoken">this post</a>. In everyday conversation both feel immediate; Google has the edge when both languages sound alike and the opening words are ambiguous.</p>
<h2>What happens to your words</h2>
<p>Google Translate sends audio to Google. Parley's speech recognition runs through your browser's engine and translation through public engines, with no Parley server in between, and you can point Parley at your own LibreTranslate server for fully private use. Conversations stay on your device in both cases, but Parley saves the audio too and replays it bubble by bubble.</p>
<h2>Languages</h2>
<p>Google covers over a hundred languages. Parley covers 28, chosen for in-person conversations. If your language is not on <a href="/faq">the list</a>, use Google.</p>
<h2>The decision</h2>
<p>Need a rare language or fully offline use: Google Translate. Want to open a link on any device, keep the conversation and its audio, and keep it private: <a href="/app">Parley</a>. The full table is on the <a href="/compare">comparison page</a>, which also covers Apple Translate.</p>'''),
]
post_links = []
for slug, date, title, desc, body in POSTS:
    url = SITE + '/blog/' + slug
    ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": title, "description": desc, "datePublished": date, "dateModified": date, "url": url,
          "author": {"@type": "Person", "name": "Frankie Rossi", "url": SITE}, "publisher": ORG, "mainEntityOfPage": url, "about": {"@type": "SoftwareApplication", "name": "Parley", "url": SITE}}
    art = f'<article><p class="eyebrow">Parley blog</p><h1>{title}</h1><p class="meta">{date} · by Frankie Rossi, 0xROSSI Digital</p>{body}{RELATED}</article>'
    urls.append(page('/blog/' + slug, title + ' · Parley blog', desc, art, ld=ld, ogtype='article'))
    post_links.append(f'<a href="/blog/{slug}"><b>{title}</b><span>{desc}</span></a>')
urls.append(page('/blog/', 'Parley blog: notes on live conversation translation',
 'Posts from the Parley team about building a free live translator for in-person conversations: language detection, privacy, installing on any device, and comparisons with Google Translate and Apple Translate.',
 '<div class="card"><p class="eyebrow">Blog</p><h1>Notes from building Parley</h1><p class="lede">Short, first-party posts about how Parley works and why it is built the way it is.</p><div class="post-list">' + ''.join(post_links) + '</div>' + RELATED + '</div>'))

# ---------------------------------------------------------------- llms.txt
faq_md = '\n'.join(f'- **{q}** {a}' for q, a in FAQ)
posts_md = '\n'.join(f'- [{t}]({SITE}/blog/{s}): {d}' for s, _, t, d, _ in POSTS)
open(os.path.join(ROOT, 'llms.txt'), 'w').write(f'''# Parley

> Parley is a free live conversation translator for two people in the same room. Pick two languages, put the phone between you, and each person sees what the other said in their own language as they say it. It runs in the browser (Chrome, Edge, Safari), installs to the home screen as a web app, needs no account, and keeps conversations on the device.

Made by 0xROSSI Digital (Frankie Rossi). Live at {SITE}. Source: https://github.com/EliCrossDev/parley

## What it does
- Live, two-way translation of an in-person conversation (no call): light bubbles are one language, dark bubbles the other, big enough to read across a table.
- Detects which of the two languages is being spoken from the first two words (on-device word lists, script detection, translator fallback); either person can tap a chip to override.
- Translation appears while the sentence is still being said; the engine switches languages during the silence after each line.
- Optional spoken playback with Kokoro, an open-source neural voice model that runs on the device.
- Conversations saved on the device with audio, replayable bubble by bubble. Free keeps the last 5; supporters keep all, can export transcripts, and can auto-trim to any number.
- 28 languages: English, Spanish, Portuguese, Chinese, Hindi, Thai, Korean, Japanese, French, German, Italian, Arabic, Russian, Indonesian, Vietnamese, Turkish, Dutch, Polish, Filipino, Swahili, Bengali, Urdu, Hebrew, Greek, Swedish, Ukrainian, Malay, Persian.
- Interface available in English, Spanish, Portuguese, French, German, Italian, Korean, Japanese and Chinese.
- Translation engine is selectable: public engines, or your own LibreTranslate server for private unlimited use.

## Pricing
Free for everyone, no account. Optional pay-what-you-want supporter upgrade (one time, no subscription): unlimited history, recordings kept until deleted, transcript export.

## Pages
- [Home]({SITE}/): overview and install
- [Open the app]({SITE}/app)
- [How it works]({SITE}/how-it-works): the pipeline, step by step
- [Parley vs Google Translate vs Apple Translate]({SITE}/compare): honest comparison table
- [FAQ]({SITE}/faq)
- [Blog]({SITE}/blog/)
- [Full text for language models]({SITE}/llms-full.txt)

## Blog posts
{posts_md}

## FAQ
{faq_md}
''')
# llms-full: everything inline
import re
def strip(html):
    t = re.sub(r'<h2[^>]*>', '\n## ', html); t = re.sub(r'<h1[^>]*>', '\n# ', t); t = re.sub(r'<(p|li)[^>]*>', '\n', t)
    t = re.sub(r'<a href="([^"]+)"[^>]*>([^<]*)</a>', lambda m: f'[{m.group(2)}]({m.group(1) if m.group(1).startswith("http") else SITE + m.group(1)})', t)
    t = re.sub(r'<tr>', '\n| ', t); t = re.sub(r'</t[dh]>', ' | ', t)
    t = re.sub(r'<[^>]+>', '', t); return re.sub(r'\n{3,}', '\n\n', t).strip()
full = [open(os.path.join(ROOT, 'llms.txt')).read(), '\n---\n']
for path in ['how-it-works.html', 'compare.html', 'faq.html'] + [f'blog/{s}.html' for s, *_ in POSTS]:
    h = open(os.path.join(ROOT, path)).read(); m = re.search(r'<main>(.*)</main>', h, re.S); full.append(strip(m.group(1)).replace('Keep reading:', '') + '\n\n---\n')
open(os.path.join(ROOT, 'llms-full.txt'), 'w').write('\n'.join(full))

# ---------------------------------------------------------------- robots + sitemap
open(os.path.join(ROOT, 'robots.txt'), 'w').write(f'''# Parley welcomes search engines and AI assistants.
User-agent: *
Allow: /
Disallow: /api/

# AI crawlers, explicitly allowed
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Bingbot
Allow: /
User-agent: meta-externalagent
Allow: /
User-agent: Amazonbot
Allow: /
User-agent: DuckAssistBot
Allow: /
User-agent: YouBot
Allow: /
User-agent: cohere-ai
Allow: /
User-agent: MistralAI-User
Allow: /

Sitemap: {SITE}/sitemap.xml
''')
all_urls = [SITE + '/', SITE + '/app'] + urls
open(os.path.join(ROOT, 'sitemap.xml'), 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.w3.org/1999/sitemap/0.9">\n' + '\n'.join(f'  <url><loc>{u}</loc><lastmod>{TODAY}</lastmod></url>' for u in all_urls) + '\n</urlset>\n')
print('built', len(all_urls), 'urls')
