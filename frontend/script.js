// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

// Check for saved theme preference or default to 'light' mode
const currentTheme = localStorage.getItem('theme') || 'light';
html.setAttribute('data-theme', currentTheme);

themeToggle.addEventListener('click', () => {
    const theme = html.getAttribute('data-theme');
    const newTheme = theme === 'light' ? 'dark' : 'light';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update icon
    themeToggle.innerHTML = newTheme === 'light'
        ? '<i class="fas fa-moon"></i>'
        : '<i class="fas fa-sun"></i>';
});

// Update icon on load
if (currentTheme === 'dark') {
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

// Mobile Menu Toggle
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const navList = document.querySelector('.nav-list');

mobileMenuToggle.addEventListener('click', () => {
    navList.classList.toggle('active');
    const icon = mobileMenuToggle.querySelector('i');
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-times');
});

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navList.classList.remove('active');
        const icon = mobileMenuToggle.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    });
});

// Search Functionality
const searchBtn = document.getElementById('searchBtn');
const searchOverlay = document.getElementById('searchOverlay');
const searchClose = document.getElementById('searchClose');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchBtn.addEventListener('click', () => {
    searchOverlay.classList.add('active');
    searchInput.focus();
});

searchClose.addEventListener('click', () => {
    searchOverlay.classList.remove('active');
    searchInput.value = '';
    searchResults.style.display = 'none';
});

// Close search on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchOverlay.classList.contains('active')) {
        searchOverlay.classList.remove('active');
        searchInput.value = '';
        searchResults.style.display = 'none';
    }
});

// Search functionality
const searchableContent = [
    { title: 'About PVPIT', url: '#about', description: 'Learn about our institution and history' },
    { title: 'Vision & Mission', url: '#about', description: 'Our vision, mission and quality policy' },
    { title: 'Computer Engineering', url: '#programs', description: 'Learn about computer engineering program' },
    { title: 'Mechanical Engineering', url: '#programs', description: 'Learn about mechanical engineering program' },
    { title: 'Electronics & Telecommunication', url: '#programs', description: 'Learn about E&TC program' },
    { title: 'Electrical Engineering', url: '#programs', description: 'Learn about electrical engineering program' },
    { title: 'Placements', url: '#placements', description: 'View our placement records and recruiters' },
    { title: 'Events', url: '#events', description: 'Latest events and activities' },
    { title: 'Contact Us', url: '#contact', description: 'Get in touch with us' },
    { title: 'Admission', url: '#admission', description: 'Admission information and process' }
];

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();

    if (query.length > 0) {
        const results = searchableContent.filter(item =>
            item.title.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        );

        if (results.length > 0) {
            searchResults.innerHTML = results.map(item => `
                <div class="search-result-item" style="padding: 15px; border-bottom: 1px solid #e0e0e0; cursor: pointer;">
                    <h4 style="margin-bottom: 5px; color: var(--primary-color);">${item.title}</h4>
                    <p style="color: var(--text-light); font-size: 14px; margin: 0;">${item.description}</p>
                </div>
            `).join('');

            searchResults.style.display = 'block';

            // Add click handlers to results
            document.querySelectorAll('.search-result-item').forEach((item, index) => {
                item.addEventListener('click', () => {
                    window.location.href = results[index].url;
                    searchOverlay.classList.remove('active');
                    searchInput.value = '';
                    searchResults.style.display = 'none';
                });
            });
        } else {
            searchResults.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-light);">No results found</p>';
            searchResults.style.display = 'block';
        }
    } else {
        searchResults.style.display = 'none';
    }
});

// Stats Counter Animation
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumbers = entry.target.querySelectorAll('.stat-number');
            statNumbers.forEach(stat => {
                const target = parseInt(stat.getAttribute('data-target'));
                animateCounter(stat, target);
            });
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.stats-section');
if (statsSection) {
    statsObserver.observe(statsSection);
}

function animateCounter(element, target) {
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 30);
}

// Smooth Scrolling for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href !== '#admission') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// Active Navigation Link on Scroll
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
    let current = '';

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= sectionTop - 200) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Back to Top Button
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        backToTop.classList.add('visible');
    } else {
        backToTop.classList.remove('visible');
    }
});

backToTop.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// Chatbot Functionality
const chatbotToggle = document.getElementById('chatbotToggle');
const chatbot = document.getElementById('chatbot');
const chatbotClose = document.getElementById('chatbotClose');
const chatbotInput = document.getElementById('chatbotInput');
const chatbotSend = document.getElementById('chatbotSend');
const chatbotBody = document.getElementById('chatbotBody');

// ── Multilingual Configuration ────────────────────────────────────────────────
const LANG_CONFIG = {
    en: {
        voice: 'en-IN',
        placeholder: 'Type your message...',
        welcome: "Hello! 👋 I'm PVPIT Assistant. How can I help you today?",
        title: 'PVPIT Assistant',
        listening: '🎤 Listening...',
        notConnected: '⚠️ Chatbot server not connected.',
        pdfDownload: '📄 Download as PDF',
        pdfGenerating: '⏳ Generating PDF…',
        pdfDone: '✅ PDF Downloaded',
        pdfFail: '❌ Failed — try again',
    },
    hi: {
        voice: 'hi-IN',
        placeholder: 'अपना संदेश लिखें...',
        welcome: 'नमस्ते! 👋 मैं PVPIT सहायक हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?',
        title: 'PVPIT सहायक',
        listening: '🎤 सुन रहा हूँ...',
        notConnected: '⚠️ चैटबॉट सर्वर से कनेक्ट नहीं हो सका।',
        pdfDownload: '📄 PDF डाउनलोड करें',
        pdfGenerating: '⏳ PDF बन रही है…',
        pdfDone: '✅ PDF डाउनलोड हो गई',
        pdfFail: '❌ विफल — पुनः प्रयास करें',
    },
    mr: {
        voice: 'mr-IN',
        placeholder: 'आपला संदेश टाइप करा...',
        welcome: 'नमस्कार! 👋 मी PVPIT सहाय्यक आहे. आज मी तुम्हाला कशी मदत करू शकतो?',
        title: 'PVPIT सहाय्यक',
        listening: '🎤 ऐकत आहे...',
        notConnected: '⚠️ चॅटबॉट सर्व्हरशी कनेक्ट होऊ शकलो नाही।',
        pdfDownload: '📄 PDF डाउनलोड करा',
        pdfGenerating: '⏳ PDF तयार होत आहे…',
        pdfDone: '✅ PDF डाउनलोड झाली',
        pdfFail: '❌ अयशस्वी — पुन्हा प्रयत्न करा',
    },
    gu: {
        voice: 'gu-IN',
        placeholder: 'તમારો સંદેશ ટાઈપ કરો...',
        welcome: 'નમસ્તે! 👋 હું PVPIT સહાયક છું. આજે હું તમને કેવી રીતે મદદ કરી શકું?',
        title: 'PVPIT સહાયક',
        listening: '🎤 સાંભળી રહ્યો છું...',
        notConnected: '⚠️ ચેટબોટ સર્વર સાથે જોડાઈ શક્યા નહીં।',
        pdfDownload: '📄 PDF ડાઉનલોડ કરો',
        pdfGenerating: '⏳ PDF બની રહી છે…',
        pdfDone: '✅ PDF ડાઉનલોડ થઈ',
        pdfFail: '❌ નિષ્ફળ — ફરી પ્રયાસ કરો',
    },
};

let currentLang = localStorage.getItem('chatLang') || 'en';

function applyLanguage(lang, isInit = false) {
    const cfg = LANG_CONFIG[lang] || LANG_CONFIG.en;
    const prevLang = currentLang;
    currentLang = lang;
    localStorage.setItem('chatLang', lang);

    // Update input placeholder and header title
    chatbotInput.placeholder = cfg.placeholder;
    const titleEl = document.getElementById('chatbotTitle');
    if (titleEl) titleEl.textContent = cfg.title;

    // Highlight active language button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Clear chat history and show fresh welcome in new language
    // (only clear if language actually changed — not on first page load)
    if (!isInit && prevLang !== lang) {
        chatbotBody.innerHTML = '';
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'chatbot-message bot-message';
        welcomeDiv.innerHTML = `<p>${cfg.welcome}</p>`;
        chatbotBody.appendChild(welcomeDiv);
    } else if (isInit) {
        // On page load just update the existing welcome text
        const welcomeEl = document.getElementById('chatbotWelcome');
        if (welcomeEl) welcomeEl.textContent = cfg.welcome;
    }
}

document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Stop any ongoing speech when switching language
        stopSpeech();
        applyLanguage(btn.dataset.lang);
    });
});

// Open chatbot
chatbotToggle.addEventListener('click', () => {
    chatbot.classList.toggle('active');
    if (chatbot.classList.contains('active')) {
        chatbotInput.focus();
    }
});

// Close chatbot
chatbotClose.addEventListener('click', () => {
    chatbot.classList.remove('active');
});

// ── Markdown table → HTML table converter ───────────────────────────────────
function mdTableToHtml(text) {
    const lines = text.split('\n');
    let result = '';
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        // Detect start of a markdown table (pipe-delimited)
        if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s\-|:]+\|$/.test(lines[i + 1].trim())) {
            let tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            // Build HTML table
            let html = '<table class="chatbot-table"><thead>';
            let isHead = true;
            tableLines.forEach(tl => {
                if (/^\|[\s\-|:]+\|$/.test(tl)) { html += '</thead><tbody>'; isHead = false; return; }
                const cells = tl.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
                const tag = isHead ? 'th' : 'td';
                html += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
            });
            html += '</tbody></table>';
            result += html;
        } else {
            // Normal line — convert basic markdown
            let formatted = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/^## (.+)/, '<strong style="display:block;margin:6px 0 2px;color:#c0392b">$1</strong>')
                .replace(/^# (.+)/, '<strong style="display:block;margin:6px 0 2px;color:#c0392b">$1</strong>')
                .replace(/^[-*•] (.+)/, '&bull; $1');
            result += (line ? `<span style="display:block;margin:2px 0">${formatted}</span>` : '<br>');
            i++;
        }
    }
    return result;
}

// ==============================
// Text-to-Speech (TTS) Engine
// ==============================

let ttsEnabled = localStorage.getItem('ttsEnabled') !== 'false'; // default ON
let ttsSpeaking = false;

function updateTTSButton() {
    const btn = document.getElementById('ttsToggleBtn');
    if (!btn) return;
    if (ttsEnabled) {
        btn.innerHTML = '<i class="fas fa-volume-up"></i>';
        btn.title = 'Voice reply ON — click to mute';
        btn.classList.add('tts-active');
    } else {
        btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        btn.title = 'Voice reply OFF — click to enable';
        btn.classList.remove('tts-active');
    }
}

// ── Language → Google TTS lang code mapping ───────────────────────────────────
const GTTS_LANG = {
    en: 'en',
    hi: 'hi',
    mr: 'mr',
    gu: 'gu',
};

// Currently playing audio element (so we can stop it)
let ttsAudio = null;
let ttsChunkQueue = [];  // queue of chunks to play

// Strip HTML & markdown to get clean plain text for speech
function cleanTextForSpeech(text) {
    return text
        .replace(/<[^>]+>/g, ' ')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .replace(/[-•]\s/g, '')
        .replace(/\|[^|\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Stop any currently speaking audio immediately
function stopSpeech() {
    ttsChunkQueue = []; // clear queue so next chunk doesn't play
    if (ttsAudio) {
        ttsAudio.pause();
        ttsAudio.src = '';
        ttsAudio = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    ttsSpeaking = false;
}

// Split long text into chunks ≤ 180 chars at sentence/phrase boundaries
function splitIntoChunks(text, maxLen = 180) {
    // Split on Devanagari danda (।), period, !, ?, newline
    const sentences = text.match(/[^।.!?\n]+[।.!?\n]*/g) || [text];
    const chunks = [];
    let current = '';
    for (const s of sentences) {
        if ((current + s).length > maxLen) {
            if (current.trim()) chunks.push(current.trim());
            current = s;
        } else {
            current += s;
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(c => c.length > 1);
}

// Play one chunk via backend /tts proxy, return Promise
function playChunk(chunk, langCode) {
    return new Promise((resolve) => {
        const url = `${window.BACKEND_URL}/tts?lang=${encodeURIComponent(langCode)}&text=${encodeURIComponent(chunk)}`;
        const audio = new Audio(url);
        ttsAudio = audio;

        audio.onended = () => { ttsAudio = null; resolve(); };
        audio.onerror = (e) => {
            console.warn('TTS chunk error:', e);
            ttsAudio = null;
            resolve(); // skip bad chunk, continue with next
        };
        audio.play().catch((e) => {
            console.warn('TTS play() blocked:', e);
            ttsAudio = null;
            resolve();
        });
    });
}

// Play all chunks sequentially
async function playChunksSequentially(chunks, langCode) {
    ttsChunkQueue = [...chunks];
    for (const chunk of chunks) {
        // Check if stopped mid-way
        if (!ttsSpeaking || ttsChunkQueue.length === 0) break;
        ttsChunkQueue.shift();
        await playChunk(chunk, langCode);
    }
    ttsSpeaking = false;
}

async function speakText(text) {
    if (!ttsEnabled) return;

    // Stop any previous speech
    stopSpeech();

    const plain = cleanTextForSpeech(text);
    if (!plain) return;

    const langCode = GTTS_LANG[currentLang] || 'en';

    // English: use browser Web Speech (no proxy needed, no CORS issues)
    if (currentLang === 'en') {
        if (!('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(plain);
        utterance.lang = 'en-IN';
        utterance.rate = 0.92;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.onstart = () => { ttsSpeaking = true; };
        utterance.onend = () => { ttsSpeaking = false; };
        utterance.onerror = () => { ttsSpeaking = false; };
        window.speechSynthesis.speak(utterance);
        return;
    }

    // Hindi / Marathi / Gujarati → Flask /tts proxy → Google Translate audio
    ttsSpeaking = true;
    const chunks = splitIntoChunks(plain, 180);
    console.log(`🔊 TTS [${langCode}] — ${chunks.length} chunk(s):`, chunks);

    try {
        await playChunksSequentially(chunks, langCode);
    } catch (e) {
        console.warn('TTS playback error:', e);
        ttsSpeaking = false;
    }
}

// ── Add message to chat window ───────────────────────────────────────────────
// Extract /pdfs/ URL from a bot reply if present
function extractLocalPdfUrl(text) {
    const match = text.match(/http:\/\/localhost:5000(\/pdfs\/[^\s)\]"']+)/);
    return match ? match[0] : null;
}

function addMessage(message, isUser = false, pdfInfo = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${isUser ? 'user-message' : 'bot-message'}`;

    if (isUser) {
        messageDiv.innerHTML = `<p>${message}</p>`;
    } else {
        // Render markdown tables + basic formatting
        // Also make URLs in the reply clickable
        let htmlContent = mdTableToHtml(message);
        // Make http:// links clickable
        htmlContent = htmlContent.replace(
            /(https?:\/\/[^\s<>"']+)/g,
            '<a href="$1" target="_blank" rel="noopener" style="color:#c0392b;word-break:break-all;">$1</a>'
        );
        messageDiv.innerHTML = `<div class="bot-content">${htmlContent}</div>`;

        // Prefer directPdf passed from backend; fall back to parsing message text
        const localPdfUrl = (pdfInfo && pdfInfo.directPdf) || extractLocalPdfUrl(message);

        if (localPdfUrl) {
            // Show "Open Timetable PDF" button that opens the actual downloaded PDF
            const openBtn = document.createElement('a');
            openBtn.href = localPdfUrl;
            openBtn.target = '_blank';
            openBtn.rel = 'noopener';
            openBtn.className = 'chatbot-pdf-btn';
            openBtn.style.cssText = 'display:inline-block;text-decoration:none;margin-right:8px;';
            openBtn.innerHTML = '📄 Open Timetable PDF';
            openBtn.title = 'Open the actual timetable PDF directly';
            messageDiv.appendChild(openBtn);

            // Also show download button that saves the actual PDF
            const dlBtn = document.createElement('a');
            dlBtn.href = localPdfUrl;
            dlBtn.download = '';
            dlBtn.className = 'chatbot-pdf-btn';
            dlBtn.style.cssText = 'display:inline-block;text-decoration:none;background:#27ae60;';
            dlBtn.innerHTML = '⬇️ Download PDF';
            dlBtn.title = 'Download the actual timetable PDF';
            messageDiv.appendChild(dlBtn);

        } else if (pdfInfo && pdfInfo.available) {
            // No local PDF — fall back to generating a text summary PDF
            const pdfBtn = document.createElement('button');
            pdfBtn.className = 'chatbot-pdf-btn';
            pdfBtn.innerHTML = LANG_CONFIG[currentLang].pdfDownload;
            pdfBtn.title = 'Save this response as a PDF file';
            pdfBtn.addEventListener('click', () => downloadChatPDF(pdfInfo.title, message, pdfBtn));
            messageDiv.appendChild(pdfBtn);
        }
    }

    chatbotBody.appendChild(messageDiv);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;

    // 🔊 Speak bot reply aloud (TTS)
    if (!isUser) {
        speakText(message);
    }
}

// ── Download chat reply as PDF ────────────────────────────────────────────────
async function downloadChatPDF(title, content, btn) {
    const cfg = LANG_CONFIG[currentLang];
    btn.disabled = true;
    btn.innerHTML = cfg.pdfGenerating;
    try {
        const res = await fetch(window.BACKEND_URL + '/chat/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, lang: currentLang }),
        });
        if (!res.ok) throw new Error('Server error');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PVPIT_${title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        btn.innerHTML = cfg.pdfDone;
        setTimeout(() => { btn.disabled = false; btn.innerHTML = cfg.pdfDownload; }, 3000);
    } catch (e) {
        btn.innerHTML = cfg.pdfFail;
        btn.disabled = false;
    }
}

// ── Send message to Python backend ───────────────────────────────────────────
async function sendMessage() {
    const message = chatbotInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    chatbotInput.value = '';

    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chatbot-message bot-message chatbot-typing';
    typingDiv.innerHTML = '<span></span><span></span><span></span>';
    chatbotBody.appendChild(typingDiv);
    chatbotBody.scrollTop = chatbotBody.scrollHeight;

    try {
        const response = await fetch(window.BACKEND_URL + '/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, lang: currentLang }),
        });
        const data = await response.json();
        typingDiv.remove();
        addMessage(data.reply, false, {
            available: data.pdf_available || false,
            title: data.pdf_title || message,
            directPdf: data.direct_pdf || null,   // actual local PDF URL from backend
        });
    } catch (error) {
        typingDiv.remove();
        addMessage(LANG_CONFIG[currentLang].notConnected, false);
    }
}

// Send button click
chatbotSend.addEventListener('click', sendMessage);

// Enter key press
chatbotInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Contact Form Submission
const contactForm = document.getElementById('contactForm');
contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // Show success message
    alert('Thank you for your message! We will get back to you soon.');
    contactForm.reset();
});

// Newsletter Form Submission
const newsletterForm = document.querySelector('.newsletter-form');
newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Thank you for subscribing to our newsletter!');
    newsletterForm.reset();
});

// Virtual Tour Button
const virtualTourBtn = document.getElementById('virtualTourBtn');
virtualTourBtn.addEventListener('click', () => {
    alert('Virtual tour feature coming soon! You can watch our campus tour video in the About section.');
});

// Animate elements on scroll
const animateOnScroll = () => {
    const elements = document.querySelectorAll('.vmq-card, .program-card, .testimonial-card, .timeline-item');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    elements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'all 0.6s ease';
        observer.observe(element);
    });
};

// Initialize animations
animateOnScroll();

// Header scroll effect
let lastScroll = 0;
const header = document.querySelector('.header');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        header.style.boxShadow = '0 5px 20px rgba(0,0,0,0.1)';
    } else {
        header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    }

    lastScroll = currentScroll;
});

// Company logos infinite scroll animation
const companiesSlider = document.querySelector('.companies-slider');
if (companiesSlider) {
    const logos = companiesSlider.innerHTML;
    companiesSlider.innerHTML += logos; // Duplicate for seamless loop

    let scrollAmount = 0;
    const scrollSpeed = 1;

    // Commenting out auto-scroll for better user experience
    // setInterval(() => {
    //     scrollAmount += scrollSpeed;
    //     if (scrollAmount >= companiesSlider.scrollWidth / 2) {
    //         scrollAmount = 0;
    //     }
    //     companiesSlider.scrollLeft = scrollAmount;
    // }, 30);
}

// Add loading animation
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
    // Restore last selected language without clearing any existing chat
    applyLanguage(currentLang, true);
});

// Parallax effect for hero section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
});

console.log('PVPIT Website - Enhanced Version Loaded Successfully! 🎉');
console.log('New Features:');
console.log('✓ Dark Mode Toggle');
console.log('✓ Advanced Search');
console.log('✓ AI Chatbot Assistant');
console.log('✓ Interactive Stats Counter');
console.log('✓ Programs Showcase');
console.log('✓ Placements Section');
console.log('✓ Events Timeline');
console.log('✓ Student Testimonials');
console.log('✓ Virtual Tour (Coming Soon)');
console.log('✓ Responsive Design');
console.log('✓ Smooth Animations');


// ==============================
// Voice Chatbot Feature
// ==============================

const voiceBtn = document.getElementById("voiceBtn");

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;

    voiceBtn.addEventListener("click", () => {
        // Always pick the currently active language for voice input
        recognition.lang = LANG_CONFIG[currentLang].voice || 'en-IN';
        addMessage(LANG_CONFIG[currentLang].listening, false);
        recognition.start();
    });

    recognition.onresult = function (event) {
        let speechText = event.results[0][0].transcript;
        speechText = speechText.toLowerCase();
        speechText = speechText.replace(/[^\w\s\u0900-\u097F\u0A80-\u0AFF]/gi, ''); // keep Devanagari + Gujarati
        speechText = speechText.trim().replace(/\s+/g, " ");
        speechText = speechText.replace(/\b(p\s*v\s*p\s*i\s*t)\b/g, "pvpit");
        chatbotInput.value = speechText;
        sendMessage();
    };

    recognition.onerror = function (event) {
        addMessage("⚠️ Voice recognition error: " + event.error, false);
    };

} else if (voiceBtn) {
    voiceBtn.style.display = "none";
}

// ── TTS Toggle Button ────────────────────────────────────────────────────────
const ttsToggleBtn = document.getElementById('ttsToggleBtn');
if (ttsToggleBtn) {
    updateTTSButton();
    ttsToggleBtn.addEventListener('click', () => {
        ttsEnabled = !ttsEnabled;
        localStorage.setItem('ttsEnabled', ttsEnabled);
        updateTTSButton();
        if (!ttsEnabled) {
            stopSpeech(); // stop Google TTS audio + Web Speech
        }
    });
}

console.log('✓ Text-to-Speech (TTS) reply enabled');