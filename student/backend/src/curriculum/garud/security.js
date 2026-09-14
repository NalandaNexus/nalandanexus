/**
 * GARUD, months 4-6: security foundations, practical defence, and the analytical
 * habits that investigation depends on.
 *
 * Month 6 deliberately pairs a reasoning module tagged ENGLISH with a forensics
 * module tagged CYBERSECURITY. Investigation is both: the reasoning is a
 * communication skill and the technique is a security skill, and tagging them
 * to one subject would misreport what the student is actually building.
 */

export const SECURITY = [
  {
    moduleId: 'garud-m07',
    title: 'Month 4 · Security Fundamentals',
    order: 7,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'garud-m07-l01',
        title: '7.1 The CIA Triad',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Confidentiality, integrity and availability - and the fact that they trade against each other.',
        content:
          'Security is usually described as protecting three properties. Confidentiality means only the right people can read something. Integrity means it has not been altered without authorisation, and that you would know if it had. Availability means it is there when it is legitimately needed.\n\n' +
          'The triad is useful because it forces you to say which property you are protecting. "Make it secure" is not a requirement; "only the finance team may read this, and any change must be attributable" is.\n\n' +
          'They also conflict, and pretending otherwise produces bad decisions. Encrypting a backup improves confidentiality and endangers availability if the key is lost. Requiring three approvals to change a record improves integrity and harms availability during an emergency. Locking an account after three failed attempts improves confidentiality and hands an attacker an easy way to deny service.\n\n' +
          'A competent security decision states which property it is favouring and what it is accepting in return. Most bad ones come from optimising one property while silently destroying another.',
      },
      {
        lessonId: 'garud-m07-l02',
        title: '7.2 Authentication vs Authorization',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Proving who you are, versus what you are allowed to do - two separate decisions.',
        content:
          'Authentication answers "who are you?". Authorization answers "may you do this?". They are separate, they fail separately, and conflating them causes a specific and common class of vulnerability.\n\n' +
          'A system that authenticates well and authorizes carelessly will let a genuine, correctly logged-in user read another user\'s records simply by changing an identifier in a URL. The user is exactly who they claim to be - authentication worked perfectly - and the failure is entirely in the second decision.\n\n' +
          'The rule that prevents it: every request must be authorized against the authenticated identity, on the server, every time. Not once at login, not by hiding the button in the interface. A client can request anything; only the server\'s check matters.\n\n' +
          'Authentication factors are traditionally grouped as something you know, something you have, and something you are. Authorization models are typically role-based - permissions attach to roles, roles attach to people - which is what makes access reviewable rather than a list of exceptions.',
      },
      {
        lessonId: 'garud-m07-l03',
        title: '7.3 Password Security',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'What actually makes a password strong, and why storage matters more than complexity.',
        content:
          'Password strength is about how many guesses an attacker needs, and guessing is done by machine at enormous speed.\n\n' +
          'Length contributes far more than symbol substitution. "P@ssw0rd!" is a dictionary word with predictable substitutions and falls immediately; four unrelated words are longer, far harder to guess, and easier to remember. Complexity rules that force one of each character type tend to produce predictable patterns - a capital at the front and a digit at the end - which attackers model directly.\n\n' +
          'Reuse is the bigger practical problem. When one site is breached, those credentials are tried everywhere else - credential stuffing. A unique password per site converts one breach into one problem instead of many.\n\n' +
          'How a system stores passwords matters more than any rule it imposes on users. Passwords must be stored as salted hashes using a deliberately slow algorithm, never encrypted and never in plain text. Encryption is reversible by whoever holds the key, which is exactly what you do not want, and a fast hash is fast for the attacker too.',
      },
      {
        lessonId: 'garud-m07-l04',
        title: '7.4 Multi-Factor Authentication',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Why a second factor works, and which second factors are actually strong.',
        content:
          'Multi-factor authentication requires evidence from more than one category: something you know, something you have, something you are. Two passwords are not two factors - they are two of the same thing, and both fall to the same attack.\n\n' +
          'It works because it breaks the economics of remote attack. Stolen credentials are useful at scale precisely because they need nothing else; requiring a second factor means the attacker also needs something physically present.\n\n' +
          'The factors are not equally strong. SMS codes are common and the weakest in wide use, because a phone number can be transferred to an attacker. Authenticator apps generating time-based codes are meaningfully better. Hardware security keys are the strongest generally available option, because they verify the site\'s identity as well as the user\'s - which means they resist phishing outright, where a code the user can be talked into typing does not.\n\n' +
          'MFA is not absolute. Fatigue attacks - repeated push prompts until someone approves one to stop them - defeat poorly designed implementations. It raises cost substantially; it does not remove risk.',
      },
      {
        lessonId: 'garud-m07-l05',
        title: '7.5 Access Control',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Models for deciding who may do what, and the drift that undermines them.',
        content:
          'Access control is the systematic form of the permissions you met in the operating systems module.\n\n' +
          'Role-based access control attaches permissions to roles and roles to people. Its advantage is reviewability: you can answer "who can approve payments?" by looking at one role, rather than auditing every individual. Attribute-based control decides from properties - department, location, time, device - and is more flexible and harder to reason about.\n\n' +
          'Two principles govern both. Least privilege: the minimum rights needed for the work. Separation of duties: no single person should control every step of a sensitive process, so the person who requests a payment does not also approve it.\n\n' +
          'The practical failure is privilege creep. People change roles and accumulate access, because granting is urgent and revoking never is. After a few years, long-serving staff hold rights nobody would grant them today. Periodic access review is the only thing that corrects this, and it is the control most often skipped.',
      },
      {
        lessonId: 'garud-m07-l06',
        title: '7.6 Security Policies',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'What policies are for, and why unenforceable ones make things worse.',
        content:
          'A security policy states what the organisation requires, so decisions do not have to be re-argued by each person who encounters them.\n\n' +
          'A usable policy says what is required, who it applies to, what happens when it cannot be met, and who decides exceptions. That last point matters: a policy with no exception process gets ignored the first time it collides with real work, and once a policy is ignorable, so are the rest.\n\n' +
          'Policies fail when they are unenforceable or ridiculous. Requiring a password change every thirty days produces sequential passwords with an incrementing digit. Banning a tool people need to do their job moves the work to unmonitored personal accounts. In both cases the policy made security worse while appearing to improve it.\n\n' +
          'This is the practical lesson: a control that people route around has negative value, because it costs effort and provides false assurance. Design for the behaviour you will actually get.',
      },
      {
        lessonId: 'garud-m07-l07',
        title: '7.7 Common Attack Categories',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'A map of how attacks are grouped, so a new one can be placed rather than memorised.',
        content:
          'Individual techniques change constantly; the categories are stable, and knowing them lets you place something unfamiliar.\n\n' +
          'Attacks on people: phishing, pretexting, and social engineering generally. These target judgement rather than technology and remain the most common successful entry point.\n\n' +
          'Attacks on credentials: guessing, stuffing reused passwords, intercepting or replaying tokens.\n\n' +
          'Attacks on software: exploiting a flaw to make a program do something it was not designed to do - injection, memory corruption, logic errors.\n\n' +
          'Attacks on configuration: the software is fine, but it was deployed with a default password, an unnecessary service exposed, or permissions set too broadly. A large share of real incidents are here.\n\n' +
          'Attacks on availability: overwhelming a service so legitimate users cannot reach it.\n\n' +
          'Real intrusions chain categories - a phishing email delivers credentials, which are used against an exposed service, which has a configuration weakness. Thinking in single techniques is what causes investigators to stop at the first finding.',
      },
    ],
    quizzes: [
      {
        quizId: 'garud-m07-q01',
        title: 'Cybersecurity Foundations',
        subject: 'CYBERSECURITY',
        timeLimitMins: 18,
        pointsReward: 70,
        questions: [
          {
            questionId: 'q1',
            question: 'A policy locks an account after three failed login attempts. Which trade-off is being made?',
            options: [
              'Availability is improved at the cost of confidentiality',
              'Confidentiality is improved at the cost of availability, since anyone can lock out a user',
              'Integrity is improved with no cost',
              'No trade-off - it is strictly better',
            ],
            correctIndex: 1,
            explanation:
              'It resists guessing but hands an attacker a trivial denial-of-service: deliberately fail three times against someone else\'s account. Naming the property you are trading is what makes it a decision rather than a reflex.',
          },
          {
            questionId: 'q2',
            question: 'A logged-in user changes the id in a URL and sees another user\'s record. Which control failed?',
            options: [
              'Authentication - the login was not verified',
              'Authorization - the request was not checked against what that identity may access',
              'Encryption - the URL was not protected',
              'Availability - the service was overloaded',
            ],
            correctIndex: 1,
            explanation:
              'Authentication worked perfectly; the user is exactly who they claim. The failure is the second, separate decision, which must be made on the server for every request.',
          },
          {
            questionId: 'q3',
            question: 'Which password is strongest against automated guessing?',
            options: ['P@ssw0rd!', 'Xk9$2', 'correct-battery-stapler-mountain', 'Summer2026!'],
            correctIndex: 2,
            explanation:
              'Length contributes far more than symbol substitution. The first and last are dictionary words with the predictable patterns attackers model directly; the second is too short regardless of its symbols.',
          },
          {
            questionId: 'q4',
            question: 'Why is a hardware security key stronger than a texted SMS code?',
            options: [
              'It generates longer codes',
              'It verifies the site\'s identity too, so it resists phishing - and cannot be transferred like a phone number',
              'It never expires',
              'It works without electricity',
            ],
            correctIndex: 1,
            explanation:
              'A code can be typed into a convincing fake site; a key checks which site is asking. SMS additionally fails because a phone number can be moved to an attacker.',
          },
          {
            questionId: 'q5',
            question: 'How should a system store user passwords?',
            options: [
              'Encrypted, so they can be recovered if a user forgets',
              'As a salted hash using a deliberately slow algorithm',
              'In plain text, protected by database permissions',
              'As a fast hash such as a simple checksum',
            ],
            correctIndex: 1,
            explanation:
              'Encryption is reversible by whoever holds the key, which is exactly what you do not want. A fast hash is fast for the attacker too; slowness is the point.',
          },
          {
            questionId: 'q6',
            question: 'Long-serving staff often hold access nobody would grant them today. What is this called, and what corrects it?',
            options: [
              'Privilege creep, corrected by periodic access review',
              'Separation of duties, corrected by encryption',
              'Least privilege, corrected by stronger passwords',
              'Attack surface, corrected by firewalls',
            ],
            correctIndex: 0,
            explanation:
              'Granting access is urgent and revoking it never is, so rights accumulate with role changes. Review is the only thing that reverses it, and it is the control most often skipped.',
          },
          {
            questionId: 'q7',
            question: 'A policy forces a password change every thirty days. What is the likely real effect?',
            options: [
              'Substantially improved security',
              'Sequential passwords with an incrementing digit - worse security with false assurance',
              'No effect at all',
              'Users adopt hardware keys instead',
            ],
            correctIndex: 1,
            explanation:
              'A control people route around has negative value: it costs effort and provides assurance that is not real. Design for the behaviour you will actually get.',
          },
        ],
      },
    ],
    tasks: [],
  },

  {
    moduleId: 'garud-m08',
    title: 'Month 4 · Threats & Vulnerabilities',
    order: 8,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'garud-m08-l01',
        title: '8.1 Malware',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Categories of malicious software by what they do, not by how they are named.',
        content:
          'Malware is software written to act against the interests of the person running it. The categories describe behaviour and overlap freely in practice.\n\n' +
          'A virus attaches itself to another file and spreads when that file is run. A worm spreads by itself across a network with no user action, which is why worms move fastest. A trojan is malicious software presented as something desirable - the deception is the delivery method. Ransomware encrypts data and demands payment. Spyware observes and reports: keystrokes, screens, files. A rootkit hides the presence of other malware, typically by interfering with the tools you would use to look.\n\n' +
          'Modern malware is usually several of these at once - a trojan that installs a rootkit and then ransomware.\n\n' +
          'The defensive point is that detection by signature - recognising known bad files - is necessary and insufficient, because a file can be altered slightly to produce a new signature. Behavioural detection asks what the program is doing rather than what it is, which is why it catches things no one has named yet.',
      },
      {
        lessonId: 'garud-m08-l02',
        title: '8.2 Phishing',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'How phishing actually works, and why spotting spelling mistakes is not a defence.',
        content:
          'Phishing is fraud that persuades someone to hand over credentials, money or access. It remains among the most successful attack methods because it targets judgement, which no patch fixes.\n\n' +
          'The reliable structure is a pretext, urgency and a link. The pretext gives a plausible reason. The urgency prevents reflection - your account will be closed, the payment is due today. The link goes somewhere that looks right.\n\n' +
          'The advice to look for bad spelling is outdated. Competent phishing is well written, correctly branded, and served over HTTPS with a valid certificate. Targeted phishing - spear phishing - is built from real details about the recipient, often taken from public profiles.\n\n' +
          'What still works as a defence is structural rather than perceptual. Check the actual domain, not the display text. Be suspicious of urgency about credentials or payment as a category. Verify any unexpected request for money or access through a channel you chose - a phone number you already have, not the one in the message. And use phishing-resistant MFA, which does not care whether you were fooled.',
      },
      {
        lessonId: 'garud-m08-l03',
        title: '8.3 Social Engineering',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'The psychological levers used against people, and why training alone is not enough.',
        content:
          'Social engineering manipulates people into acting against their own or their organisation\'s interests. Phishing is one delivery channel; the underlying levers are constant.\n\n' +
          'Authority: people comply with apparent seniority, so the attacker claims to be a director or an auditor. Urgency: time pressure suppresses verification. Reciprocity: a small favour creates a sense of obligation. Social proof: "everyone on your team has already done this". Familiarity: rapport built over several harmless messages before the request.\n\n' +
          'Physical techniques are part of it - following someone through a secured door, or leaving a USB drive where a curious person will find it.\n\n' +
          'Training helps and does not solve it, because the attack targets normal helpfulness, and an organisation where nobody helps anyone has its own problems. The durable defences are procedural: a verification route for sensitive requests that does not depend on judgement in the moment, and a culture where checking is normal and nobody is punished for slowing down a request that turned out to be genuine.',
      },
      {
        lessonId: 'garud-m08-l04',
        title: '8.4 Password Attacks',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Brute force, dictionaries, stuffing and spraying - and the defence each one needs.',
        content:
          'Password attacks differ in what the attacker already knows, and each is defeated by something different.\n\n' +
          'Brute force tries every combination. It is defeated by length, because each added character multiplies the work.\n\n' +
          'Dictionary attacks try likely passwords - real words, known-common choices, and predictable mutations. Defeated by not choosing predictable passwords, not by adding an exclamation mark to one.\n\n' +
          'Credential stuffing takes username-password pairs from one breach and tries them elsewhere. Defeated only by not reusing passwords. No amount of complexity helps, because the attacker already has the correct password.\n\n' +
          'Password spraying tries one very common password against many accounts. It is specifically designed to evade lockout, since no single account sees repeated failures. Detecting it requires looking across accounts for a pattern of single failures - which is why it succeeds against organisations that only monitor per-account.\n\n' +
          'MFA substantially reduces all four, because the password stops being sufficient on its own.',
      },
      {
        lessonId: 'garud-m08-l05',
        title: '8.5 Vulnerabilities',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'What a vulnerability is, how they are catalogued and scored, and why severity is not priority.',
        content:
          'A vulnerability is a weakness that could be used to violate confidentiality, integrity or availability. It may be a coding flaw, a design decision, or a configuration choice - and configuration is a larger share of real incidents than people expect.\n\n' +
          'Publicly known vulnerabilities are catalogued with CVE identifiers and scored for severity on a standard scale considering how easy they are to exploit and how much damage results.\n\n' +
          'The most important practical point is that severity is not priority. A critical-severity flaw in software you do not run matters less than a medium-severity flaw in the system holding your customer data and reachable from the internet. Priority is severity combined with exposure and with what the affected system actually does.\n\n' +
          'A zero-day is a vulnerability with no patch available yet. They attract attention out of proportion to their share of real incidents, most of which exploit vulnerabilities that were patched months earlier and never applied.',
      },
      {
        lessonId: 'garud-m08-l06',
        title: '8.6 Exploits — Conceptual Understanding',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'How a flaw becomes a working attack, treated conceptually and defensively.',
        content:
          'An exploit is the technique that turns a vulnerability into an actual effect. Understanding the shape of exploitation is what lets you defend and investigate; this module stays at the conceptual level and uses no real targets.\n\n' +
          'The common pattern is a boundary that was assumed and not enforced. Injection happens when data supplied by a user is treated as a command, because the code combined the two without separating them. Memory corruption happens when more data is written than a space allows, overwriting something that decides what the program does next. Logic flaws need no malformed input at all - the attacker simply does the steps in an order the designer never considered.\n\n' +
          'Chaining matters more than any single exploit. Real intrusions link a low-severity foothold to a privilege escalation to lateral movement. This is why dismissing a finding as individually minor is a recurring investigative mistake.\n\n' +
          'Defensively, the pattern points at the fixes: validate input, separate data from commands, apply least privilege so a foothold gains little, and patch so the known steps are unavailable.',
      },
      {
        lessonId: 'garud-m08-l07',
        title: '8.7 Risk Assessment',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Turning a list of threats into a defensible order of work.',
        content:
          'You cannot fix everything, so security work is fundamentally about ordering. Risk assessment is how that order is made defensible rather than instinctive.\n\n' +
          'Risk combines likelihood and impact. A highly likely event with trivial impact and a catastrophic event that is nearly impossible can both be lower priority than something moderately likely with serious consequences. Stating both makes the reasoning visible and arguable, which is the point.\n\n' +
          'Impact is not only technical. Regulatory exposure, loss of trust, and inability to operate are frequently larger than the cost of the systems involved.\n\n' +
          'There are four responses to a risk: reduce it with a control, transfer it through insurance or a contract, avoid it by not doing the activity, or accept it deliberately. Accepting is legitimate - what is not legitimate is accepting by default, without anyone deciding or recording it.\n\n' +
          'A risk assessment that never results in a decision is documentation, not a control. The output is a prioritised list somebody has agreed to act on.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'garud-m08-a01',
        title: 'Threat Analysis Report',
        type: 'Task',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 70,
        dueOffsetDays: 14,
        iconName: 'ShieldAlert',
        description:
          'Analyse the realistic threats to one organisation you know well enough to describe - your school, a small business, or a club. Use only information you are entitled to have. Do not scan, probe or test anything.\n\n' +
          'Produce a report containing:\n' +
          '1. A short description of the organisation, what it does, and what information it holds that would matter if lost or exposed.\n' +
          '2. Five realistic threats, each named with its category from lesson 7.7.\n' +
          '3. For each: likelihood and impact, each rated low/medium/high, with one sentence justifying each rating.\n' +
          '4. The five ranked in priority order, with the ranking explained - noting explicitly where your order differs from severity alone.\n' +
          '5. One recommended control per threat, including which of reduce, transfer, avoid or accept it represents.\n\n' +
          'Assessed on: whether the threats are realistic for that specific organisation rather than a generic list, whether likelihood and impact are argued rather than asserted, and whether the priority order reflects exposure and consequence rather than just the scariest-sounding item.',
      },
    ],
  },

  {
    moduleId: 'garud-m09',
    title: 'Month 5 · Network Security',
    order: 9,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'garud-m09-l01',
        title: '9.1 Firewalls',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Filtering traffic by rule, and what a firewall cannot do for you.',
        content:
          'A firewall decides which traffic may pass, based on rules referring to source, destination, port and protocol.\n\n' +
          'A stateless filter judges each packet alone. A stateful firewall tracks connections, so it can allow the return traffic of a connection you started while refusing an unsolicited connection inbound - which is what makes ordinary browsing work without exposing you.\n\n' +
          'Rule order matters: rules are evaluated in sequence and the first match wins, so a broad allow placed above a specific deny silently disables it. Misordered rules are a common real-world finding.\n\n' +
          'The correct default is deny: permit what is needed and refuse everything else. The opposite - allow by default, block known-bad - requires you to have anticipated every bad thing, which nobody manages.\n\n' +
          'Firewalls do not inspect encrypted content, do not stop an authorised user doing something harmful, and do nothing about traffic that never crosses them - which is most traffic inside a network. They are one control, and the network-segmentation lesson explains why they need company.',
      },
      {
        lessonId: 'garud-m09-l02',
        title: '9.2 IDS and IPS',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Detecting versus blocking, and the cost of each kind of mistake.',
        content:
          'An intrusion detection system watches traffic and raises an alert. An intrusion prevention system sits in the path and can stop the traffic itself. The distinction is whether it observes or intervenes, and it changes the consequence of being wrong.\n\n' +
          'Detection is by signature - matching known-bad patterns - or by anomaly, flagging departures from an established baseline. Signatures are precise and blind to anything new; anomaly detection can catch the unknown and generates far more false positives.\n\n' +
          'This is the real trade. A false positive on an IDS wastes an analyst\'s time. A false positive on an IPS blocks legitimate business traffic, and doing that once tends to produce pressure to disable the system. A false negative in either case means the attack proceeds unnoticed.\n\n' +
          'In practice organisations tune conservatively, blocking only what they are confident about and alerting on the rest. An alert nobody reads is worth nothing, so detection capacity is limited by the number of analysts, not the number of sensors.',
      },
      {
        lessonId: 'garud-m09-l03',
        title: '9.3 Network Segmentation',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Dividing a network so one compromise does not become all of them.',
        content:
          'Segmentation splits a network into zones with controlled routes between them. Its purpose is containment: assume something will be compromised, and limit what that gets the attacker.\n\n' +
          'A flat network is the opposite. One compromised laptop can reach every server, printer and database directly, so the first foothold is effectively the whole environment. Most damaging incidents involve extensive lateral movement that segmentation would have slowed or stopped.\n\n' +
          'Zones are drawn by sensitivity and function - user devices separate from servers, payment systems separate from general business systems, guest wireless separate from everything. Traffic between zones passes a control point where it is filtered and logged, which also produces the visibility to notice unusual internal movement.\n\n' +
          'Zero-trust architecture extends this to its conclusion: stop treating any network location as inherently trustworthy, and authenticate and authorise every request regardless of origin. That removes the assumption - "it came from inside" - that flat networks quietly depend on.',
      },
      {
        lessonId: 'garud-m09-l04',
        title: '9.4 Secure Wi-Fi',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Wireless risks, encryption standards, and the actual danger of public networks.',
        content:
          'Wireless removes the physical boundary. Anyone within range can receive the signal, so the encryption is doing work that a cable did for free.\n\n' +
          'WEP is broken and must never be used. WPA2 is the practical baseline; WPA3 improves on it, notably by protecting against offline guessing of the passphrase after capturing a handshake.\n\n' +
          'A shared passphrase means everyone on the network holds the same key, so on a large network it is not really a secret. Enterprise wireless authenticates each user individually, which is what makes revoking one person\'s access possible.\n\n' +
          'The specific danger of public Wi-Fi is not eavesdropping on encrypted traffic, which is largely handled by HTTPS. It is that you cannot verify the network itself. An access point named like a café\'s can be run by anyone, and it can manipulate anything not properly protected - unencrypted traffic, and certificate warnings a user is tempted to click through. On an untrusted network, use a VPN and never dismiss a certificate warning.',
      },
      {
        lessonId: 'garud-m09-l05',
        title: '9.5 VPN Concepts',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'What a VPN moves, what it hides, and the trust you are transferring.',
        content:
          'A VPN builds an encrypted tunnel between your device and a server. Traffic goes through the tunnel and emerges at the far end, so the local network sees only an encrypted connection to one destination.\n\n' +
          'Two legitimate uses. Remote access: reaching internal systems from outside as though on the internal network. And protection on untrusted networks: the café\'s access point cannot inspect or tamper with tunnelled traffic.\n\n' +
          'What a VPN actually does is move trust, not remove it. Your local network can no longer see your traffic; the VPN provider now can. Whether that is an improvement depends entirely on which you trust more - which is why "a VPN makes you anonymous" is marketing rather than a technical claim.\n\n' +
          'It also does not protect the endpoints. Malware on your device is inside the tunnel with you, and a site you log into still knows who you are. In an organisation, a VPN is an access-control mechanism, and it should be paired with MFA - otherwise a stolen password grants network-level access to everything.',
      },
      {
        lessonId: 'garud-m09-l06',
        title: '9.6 Network Monitoring',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Seeing what crosses the network, and what remains visible when content is encrypted.',
        content:
          'Monitoring is how you notice. Without it, an intrusion is discovered by its consequences, typically long afterwards.\n\n' +
          'Flow data records who talked to whom, when, for how long and how much - without content. It is cheap enough to keep at scale and answers a surprising number of investigative questions. Full packet capture records everything and is expensive to store, so it is usually kept briefly or only for selected traffic.\n\n' +
          'Encryption hides content, not metadata, and metadata is often enough. A workstation connecting to an address in a country the organisation does not operate in, at three in the morning, transferring several gigabytes outbound, is alarming without reading a single byte. Volume, timing, regularity and destination are all visible.\n\n' +
          'What makes monitoring work is the baseline again. Beaconing - a connection at a very regular interval - looks like nothing unless you know that host does not normally do that. Establishing what normal looks like is most of the work, and it must be done before the incident, not during it.',
      },
      {
        lessonId: 'garud-m09-l07',
        title: '9.7 Security Logs',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'What logs record, why time synchronisation matters, and how logs fail.',
        content:
          'Logs are the record of what systems did. In an investigation they are usually the primary evidence, and their quality decides what can be established.\n\n' +
          'Useful security logs include authentication successes and failures, privilege changes, access to sensitive data, configuration changes, and network connections. A log that records only errors misses the successful unauthorised login entirely - which is the event you most need.\n\n' +
          'Time synchronisation is the detail that ruins more investigations than any other. Correlating events across systems requires their clocks to agree; if one server is eleven minutes out, its events appear in the wrong order relative to everything else and the reconstructed sequence is wrong. Synchronise clocks and record the timezone explicitly.\n\n' +
          'Logs fail in three predictable ways: not collected, so the evidence never existed; collected but overwritten before anyone looked; or collected where an attacker with sufficient access could alter them. Forwarding logs to a separate system, promptly, addresses all three - and it must be set up before the incident, not after.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'garud-m09-a01',
        title: 'Analyse a Network Security Scenario',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 70,
        dueOffsetDays: 14,
        iconName: 'Network',
        description:
          'Work the following scenario as an analyst. Everything here is supplied; nothing is to be tested against any real system.\n\n' +
          'SCENARIO. A 60-person company has one flat network: staff laptops, the file server, the finance system and guest Wi-Fi all share it. The firewall permits all outbound traffic and blocks inbound except the web server. There is no IDS. Logs exist on each machine locally and are kept for seven days. Clocks are not synchronised. Wi-Fi uses WPA2 with one passphrase, unchanged for three years and known to former employees.\n\n' +
          'One Monday, a finance laptop is found to have been connecting to an unfamiliar external address every ten minutes for an unknown period. Finance reports a supplier bank-detail change they did not make.\n\n' +
          'Produce:\n' +
          '1. Five weaknesses in the described setup, each named with the control that addresses it.\n' +
          '2. What the regular ten-minute connection most likely indicates, and what evidence would confirm it.\n' +
          '3. Which logs you would want, and specifically what the seven-day retention and unsynchronised clocks prevent you from establishing.\n' +
          '4. The order you would investigate in, and why that order.\n' +
          '5. Three changes, ranked, that would most reduce the impact of a repeat - each justified by containment or visibility.\n\n' +
          'Assessed on: whether your reasoning follows the evidence given, whether you identify the retention and clock problems as investigative limits rather than only as weaknesses, and whether your ranking is argued.',
      },
    ],
  },

  {
    moduleId: 'garud-m10',
    title: 'Month 5 · Endpoint Security',
    order: 10,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'garud-m10-l01',
        title: '10.1 Endpoint Threats',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Why the device a person uses is the most attacked point in any organisation.',
        content:
          'An endpoint is a device a person uses - laptop, desktop, phone. Endpoints are attacked more than servers because they combine three things: a human who can be deceived, wide access to organisational resources, and far less hardening than a server receives.\n\n' +
          'The usual sequence starts with delivery through email, a web page or removable media. Then execution, which frequently requires the user to act - open the document, enable the macro, run the installer. Then persistence, so the foothold survives a reboot. Then movement towards something valuable.\n\n' +
          'Two consequences shape defence. First, the user\'s decision is part of the attack path, which is why the social-engineering material is not a separate subject. Second, an endpoint compromise is a starting point rather than an end state - the attacker is rarely interested in the laptop itself.\n\n' +
          'This is why endpoint monitoring and network segmentation belong together: one notices the foothold, the other limits what it reaches.',
      },
      {
        lessonId: 'garud-m10-l02',
        title: '10.2 Antivirus and EDR Concepts',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Signature detection, behavioural detection, and what endpoint response adds.',
        content:
          'Traditional antivirus compares files against signatures of known malware. It is fast and precise and structurally blind to anything not yet catalogued - and altering a file slightly produces a new signature.\n\n' +
          'Behavioural detection asks what a program does rather than what it is. A document process spawning a command shell, a program encrypting files in bulk, software writing itself into a startup location - these are suspicious regardless of whether the file has ever been seen before.\n\n' +
          'Endpoint detection and response adds recording and reach. It continuously logs process launches, network connections and file changes, so that when something is discovered you can reconstruct what happened rather than guess - and it allows an analyst to isolate a machine from the network remotely, which matters when containment speed decides the size of the incident.\n\n' +
          'No tool is complete. Detection can be evaded, and the recording is often more valuable than the alerting, because it is what makes an investigation possible after the fact.',
      },
      {
        lessonId: 'garud-m10-l03',
        title: '10.3 Secure Configuration',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Defaults are for convenience, not safety - and configuration causes a large share of incidents.',
        content:
          'Software ships configured to work easily, not to be safe. Default settings favour compatibility and quick setup, and the gap between that and a secure configuration is where a great many incidents live.\n\n' +
          'The recurring items are consistent: default or shared administrative credentials; services enabled that nobody uses; verbose error messages exposing internal details; permissions granted broadly because narrowing them takes time; and management interfaces reachable from far more places than necessary.\n\n' +
          'Configuration baselines solve this at scale. Define what a correctly configured machine looks like, apply it automatically, and check periodically for drift - because configuration decays as people make one-off changes to fix urgent problems and never revert them.\n\n' +
          'This is unglamorous and it outperforms most sophisticated controls. An organisation that reliably eliminates default credentials and unnecessary services has removed more real risk than one that buys advanced detection while leaving both in place.',
      },
      {
        lessonId: 'garud-m10-l04',
        title: '10.4 Patch Management',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Why patching is hard in practice, and how to prioritise when you cannot do it all at once.',
        content:
          'Most successful exploitation uses vulnerabilities that were patched months or years earlier. The technical fix existed; it had not been applied.\n\n' +
          'Patching is hard for organisational reasons rather than technical ones. Patches occasionally break things, so they need testing. Some systems cannot be restarted without disrupting business. Some software is no longer supported. And nobody has a complete inventory, so some systems are simply forgotten - which is why asset inventory is a security control and not merely administration.\n\n' +
          'Prioritisation is the practical skill. Combine severity with exposure and value: internet-facing systems first, then those holding sensitive data, then everything else. A vulnerability being actively exploited in the wild moves to the top regardless of its score.\n\n' +
          'Where a patch genuinely cannot be applied, compensating controls buy time - restrict who can reach the system, increase monitoring on it, or segment it away. That is a deliberate, recorded decision with a review date, not an indefinite silence.',
      },
      {
        lessonId: 'garud-m10-l05',
        title: '10.5 Application Security',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Trusting input, controlling what runs, and the dependencies you did not write.',
        content:
          'Applications are where most useful data is handled, so they are where a great deal of attack effort goes.\n\n' +
          'The foundational rule is that input from outside the program is not trustworthy, whoever appears to have sent it. Validation belongs on the server, because anything enforced only in the browser can simply be bypassed by not using the browser. Injection flaws exist because data supplied by a user was treated as a command; separating the two structurally, rather than by trying to filter dangerous characters, is what actually fixes them.\n\n' +
          'Application control decides which programs may run at all. Allowing only approved software is far stronger than blocking known-bad, and correspondingly harder to operate.\n\n' +
          'Dependencies deserve specific attention. A modern application is mostly code somebody else wrote, and a vulnerability in a widely used library is inherited by everything that includes it - so knowing what your software actually depends on is a prerequisite to knowing whether you are affected by an advisory.',
      },
      {
        lessonId: 'garud-m10-l06',
        title: '10.6 Device Hardening',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Reducing a device to what it needs, and protecting it when it leaves the building.',
        content:
          'Hardening removes capability that is not needed, on the principle that what is not present cannot be attacked.\n\n' +
          'In practice: uninstall unused software, disable unused services and ports, remove or rename default accounts, turn off legacy protocols kept only for compatibility, and enforce least privilege so daily work does not run with administrative rights - which is the single highest-value item on the list.\n\n' +
          'Portable devices add physical risk. Full-disk encryption is what makes a lost laptop an inconvenience rather than a data breach, because without it the drive can simply be read in another machine, with the login password irrelevant. Screen lock timeouts, secure boot and the ability to wipe a device remotely complete the set.\n\n' +
          'The trade-off is real: hardening removes convenience, and hardening so aggressively that people cannot work produces workarounds that are worse than what you prevented. The judgement is where to stop, and it is the same judgement as in the security-policy lesson.',
      },
    ],
    quizzes: [
      {
        quizId: 'garud-m10-q01',
        title: 'Endpoint Security Assessment',
        subject: 'CYBERSECURITY',
        timeLimitMins: 15,
        pointsReward: 60,
        questions: [
          {
            questionId: 'q1',
            question: 'Why does signature-based antivirus alone leave a significant gap?',
            options: [
              'It slows the machine down too much',
              'It can only detect what has already been catalogued, and small changes produce a new signature',
              'It only works on servers',
              'It cannot scan removable media',
            ],
            correctIndex: 1,
            explanation:
              'Signatures are precise and structurally blind to the unseen. Behavioural detection asks what a program is doing instead, which is why it catches things nobody has named yet.',
          },
          {
            questionId: 'q2',
            question: 'A laptop is stolen. Which single control most determines whether this is a data breach?',
            options: ['A strong login password', 'Full-disk encryption', 'Antivirus software', 'A screen lock timeout'],
            correctIndex: 1,
            explanation:
              'Without encryption the drive can be read in another machine and the login password never applies. Encryption is what makes a lost device an inconvenience instead of a breach.',
          },
          {
            questionId: 'q3',
            question: 'Most successful exploitation uses vulnerabilities that were already patched. What does this imply about priorities?',
            options: [
              'Zero-days are the main risk to address',
              'Reliable patching and asset inventory outperform most sophisticated controls',
              'Patching is unnecessary',
              'Antivirus should be replaced',
            ],
            correctIndex: 1,
            explanation:
              'The fix existed and was not applied - frequently because nobody knew the system was there. Asset inventory is a security control, not administration.',
          },
          {
            questionId: 'q4',
            question: 'Validation of user input is implemented in the browser only. Why is this insufficient?',
            options: [
              'Browsers are slower at validation',
              'Anything enforced only in the browser can be bypassed by not using the browser',
              'It uses too much memory',
              'It is fine, provided the site uses HTTPS',
            ],
            correctIndex: 1,
            explanation:
              'A client can send whatever it likes. Only the server\'s check is a control; the browser\'s is a convenience for honest users.',
          },
          {
            questionId: 'q5',
            question: 'Which observation is most suspicious on an endpoint?',
            options: [
              'A browser making many outbound connections',
              'A word processor process whose child process is a command shell',
              'Antivirus scanning files overnight',
              'A large file being copied to a USB drive by an administrator',
            ],
            correctIndex: 1,
            explanation:
              'It is the relationship, not either process alone. A document application spawning a shell is a classic execution pattern and is why process parentage matters in an investigation.',
          },
          {
            questionId: 'q6',
            question: 'A patch cannot be applied because the system cannot be restarted. What is the correct response?',
            options: [
              'Record it as accepted risk and take no further action',
              'Apply compensating controls - restrict access, increase monitoring, segment it - with a review date',
              'Remove the system from the asset inventory',
              'Disable logging to reduce load',
            ],
            correctIndex: 1,
            explanation:
              'Compensating controls buy time, and the decision is recorded with a date to revisit. Accepting by default, with nobody deciding or recording it, is what is not legitimate.',
          },
        ],
      },
    ],
    tasks: [],
  },

  {
    moduleId: 'garud-m11',
    title: 'Month 6 · Analytical Thinking',
    order: 11,
    subject: 'ENGLISH',
    lessons: [
      {
        lessonId: 'garud-m11-l01',
        title: '11.1 Problem Decomposition',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Breaking a problem into parts that can actually be tested separately.',
        content:
          'Large problems resist being solved directly. Decomposition splits them into parts small enough to answer one at a time.\n\n' +
          'A good decomposition has parts that are independently testable and that together cover the whole problem. "The website is slow" might split into: is it slow for everyone or some people, slow always or at certain times, slow to respond or slow to render? Each of those can be checked, and each answer eliminates a large region of possibility.\n\n' +
          'A bad decomposition produces parts you cannot test, or parts that overlap so results contradict each other.\n\n' +
          'The value is in elimination. A well-chosen first question roughly halves the remaining space; a poorly chosen one leaves you where you started. Ask which question would most change what you do next, and ask that one first.\n\n' +
          'This is the same reasoning as the layered network troubleshooting in month 3, and the same reasoning you will apply to evidence in month 7.',
      },
      {
        lessonId: 'garud-m11-l02',
        title: '11.2 Evidence vs Assumption',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Keeping the two apart, and labelling clearly which is which.',
        content:
          'The most damaging errors in investigation come from assumptions that were recorded as facts.\n\n' +
          'Evidence is what you observed. An assumption is what you inferred, or what someone told you, or what is usually true. All three are legitimate inputs - the failure is not distinguishing them, so that by the third step nobody remembers which was which.\n\n' +
          'A practical discipline is to write findings with their source attached: "the log shows a login at 02:14" is evidence; "the login at 02:14 was the attacker" is an inference from it; "the account belongs to a user who was asleep" is a report from someone. Each carries different weight and each can be wrong in different ways.\n\n' +
          'Ask of any statement in your notes: how do I know this? If the answer is "it stands to reason" or "somebody said so", label it accordingly.\n\n' +
          'This is what allows a conclusion to be revised cleanly when new evidence arrives - you can see which parts rested on what, instead of having to rebuild everything.',
      },
      {
        lessonId: 'garud-m11-l03',
        title: '11.3 Logical Reasoning',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Deduction, induction, and the fallacies that appear most often in technical work.',
        content:
          'Deduction moves from general rules to a specific conclusion, and is certain if the premises are true. Induction generalises from observations and is probable, never certain - most investigative reasoning is inductive, which is why conclusions should carry a confidence level.\n\n' +
          'Three fallacies recur in technical work.\n\n' +
          'Affirming the consequent: "malware causes high CPU; CPU is high; therefore malware". Many things cause high CPU. The rule does not run backwards.\n\n' +
          'Confusing correlation with causation: the outage began after the update, so the update caused it. Perhaps - or both followed something else, or the timing is coincidence. Sequence is evidence for causation, not proof of it.\n\n' +
          'Confirmation bias: once you have a theory, you notice supporting evidence and discount contradicting evidence, usually without realising. The counter-discipline is to deliberately ask what you would expect to see if your theory were wrong, and then to look for that.\n\n' +
          'Stating a confidence level - likely, possible, confirmed - is not hedging. It is accuracy about how strong your reasoning actually is.',
      },
      {
        lessonId: 'garud-m11-l04',
        title: '11.4 Pattern Recognition',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Finding real signal in volume - and resisting patterns that are not there.',
        content:
          'Analysis frequently means finding the meaningful few events among many ordinary ones.\n\n' +
          'Useful patterns come in recognisable shapes. Repetition at a regular interval suggests automation, since humans are irregular. A sudden change in rate - of failures, of traffic, of file writes - marks a moment worth examining. Clustering in time links events that may share a cause. A sequence appearing in the same order repeatedly suggests a process rather than coincidence.\n\n' +
          'The opposite risk is real. Humans find patterns in randomness reliably, and an analyst who has decided what happened will assemble a convincing pattern from unrelated events.\n\n' +
          'Two defences. Ask how likely this pattern would be by chance given how much data you searched - looking at a million events, striking coincidences are certain to appear. And seek an independent corroboration from a different source; a pattern in one log that is invisible everywhere else deserves suspicion.\n\n' +
          'This is why baselines matter. Without knowing what is normal, everything looks like a pattern.',
      },
      {
        lessonId: 'garud-m11-l05',
        title: '11.5 Root Cause Analysis',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Getting past the immediate trigger to the condition that allowed it.',
        content:
          'The first explanation you find is usually a symptom. Root cause analysis is the discipline of continuing past it.\n\n' +
          'Repeatedly asking why is the simplest method. The server failed - why? It ran out of disk - why? Logs were not rotated - why? The configuration was never applied to this machine - why? It was built manually outside the standard process. The first answer suggests clearing a disk; the last suggests fixing how machines are built.\n\n' +
          'Most incidents have several contributing causes rather than one. A failure that required three things to go wrong has three places it could have been prevented, and the cheapest is not always the most obvious.\n\n' +
          'Stopping at human error is almost always stopping too early. "The operator ran the wrong command" invites asking why that was possible, why it was not caught, and why the system permitted it without confirmation. Systems that depend on nobody making a mistake will fail, because everyone does.\n\n' +
          'The test of the analysis is whether the fix would prevent recurrence, or only this exact instance.',
      },
      {
        lessonId: 'garud-m11-l06',
        title: '11.6 Decision Making',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Deciding with incomplete information, and recording why.',
        content:
          'In security you routinely decide before you know enough, because waiting is itself a decision with consequences.\n\n' +
          'Separate reversible decisions from irreversible ones. Isolating a machine from the network is reversible and cheap - do it quickly on suspicion. Wiping and rebuilding it destroys evidence and is not reversible - that deserves more certainty and more agreement.\n\n' +
          'State what you would need to know to change your mind. This converts a stance into a hypothesis, and it makes changing your mind later a normal outcome rather than a defeat.\n\n' +
          'Record the decision, the reasoning and what you knew at the time. Decisions are reviewed later by people who know how it turned out, and hindsight makes every judgement look obvious. A contemporaneous record is what allows a decision to be judged on the information that was actually available.\n\n' +
          'Deciding nothing is not neutral. Where the harm is ongoing, delay has the same standing as any other choice and should be justified the same way.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'garud-m11-a01',
        title: 'Solve a Structured Investigation Scenario',
        type: 'Task',
        subject: 'ENGLISH',
        urgency: 'high',
        pointsReward: 70,
        dueOffsetDays: 14,
        iconName: 'Search',
        description:
          'Reason your way through the following, showing your working. This assesses your reasoning, not your security knowledge.\n\n' +
          'SCENARIO. A school\'s attendance system shows a sharp rise in students marked absent, starting on a Tuesday. Staff insist attendance has not changed. You establish these facts, and only these:\n' +
          '- The rise began at 09:15 on Tuesday 3rd.\n' +
          '- A software update was installed on Monday 2nd at 18:00.\n' +
          '- The affected records all come from classes in one building.\n' +
          '- That building\'s network had a 20-minute outage on Tuesday from 09:05.\n' +
          '- One teacher reports the app "took ages to save" on Tuesday morning.\n' +
          '- Records from before Tuesday are unaffected.\n\n' +
          'Produce:\n' +
          '1. Three candidate explanations, each consistent with all six facts.\n' +
          '2. For each, what you would expect to observe if it were true - including at least one thing you would expect NOT to see.\n' +
          '3. The single check you would perform first, and what makes it the most informative.\n' +
          '4. A statement separating, explicitly, what is evidence here from what you have inferred.\n' +
          '5. One conclusion with a confidence level (confirmed / likely / possible) and the reason for that level.\n\n' +
          'Assessed on: whether your explanations genuinely fit all the facts rather than the memorable ones, whether step 2 shows you thought about disconfirming evidence, and whether step 4 keeps evidence and inference properly apart.',
      },
    ],
  },

  {
    moduleId: 'garud-m12',
    title: 'Month 6 · Introduction to Digital Investigation',
    order: 12,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'garud-m12-l01',
        title: '12.1 What Is Digital Forensics?',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Establishing what happened, to a standard that survives being questioned.',
        content:
          'Digital forensics is the disciplined recovery and analysis of digital evidence to establish what happened, in a way that holds up when challenged.\n\n' +
          'That last clause is the whole difference from ordinary troubleshooting. Troubleshooting only needs to fix the problem; forensics needs the account of what happened to remain defensible when someone with an interest in disputing it examines your method.\n\n' +
          'It follows a consistent sequence: identify what may hold evidence, preserve it without alteration, analyse the preserved copy, and present findings understandably.\n\n' +
          'Three principles run through all of it. Work on copies, never originals. Document everything as you do it, including what you tried and discarded. And be able to demonstrate that the evidence did not change while in your possession.\n\n' +
          'You will not be conducting legal proceedings. But the habits - preserve first, document as you go, distinguish evidence from inference - are exactly what makes an ordinary incident report trustworthy.',
      },
      {
        lessonId: 'garud-m12-l02',
        title: '12.2 Evidence Identification',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Knowing where evidence lives, and acting on the volatile parts first.',
        content:
          'Before preserving anything you must know what might hold something relevant. Evidence is scattered across more places than people expect.\n\n' +
          'On a device: files and their metadata, system and application logs, browser history and cache, recently used items, scheduled tasks, startup entries, and deleted-but-not-overwritten content. Off the device: server logs, network flow records, DNS queries, authentication systems, email servers, backups.\n\n' +
          'Order of volatility governs sequence. Some evidence disappears fast - running processes, network connections, memory contents - and vanishes at shutdown. Disk contents persist. Backups persist longest. Collect the most volatile first, or you will have destroyed it by the time you get there.\n\n' +
          'This produces a genuine tension. Pulling the power preserves the disk in its exact state but destroys memory and live connections. Leaving it running preserves those but allows the system, or an attacker, to keep changing things. There is no universally right answer, which is precisely why the decision and its reasoning are recorded.',
      },
      {
        lessonId: 'garud-m12-l03',
        title: '12.3 Evidence Preservation',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Capturing evidence without altering it, and proving that afterwards.',
        content:
          'Preservation aims to capture evidence in a state you can later demonstrate was unchanged.\n\n' +
          'The core technique is imaging: a bit-for-bit copy of the entire storage, not a copy of the visible files. A file-level copy misses deleted content, slack space and metadata - the parts most likely to matter.\n\n' +
          'Write blocking prevents the examining system from altering the source while it is read. Operating systems write to disks they mount as a matter of course - updating access times, creating indexes - so simply plugging a drive in to look at it modifies it.\n\n' +
          'Hashing proves integrity. A hash is computed before and after; if they match, nothing changed. This is why the hash is recorded at the moment of acquisition and not later - a hash taken after handling proves only that nothing changed since the handling.\n\n' +
          'For the work you will do in month 7, you will be given prepared evidence packages. The point of understanding this is knowing why you analyse the copy and leave the original alone.',
      },
      {
        lessonId: 'garud-m12-l04',
        title: '12.4 Chain of Custody',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'The record of who held evidence and when, and why a gap invalidates it.',
        content:
          'Chain of custody is the documented history of evidence: who collected it, when, from where, who has held it since, and what each person did with it.\n\n' +
          'Its purpose is to exclude the possibility of tampering. An unbroken chain lets you show the evidence presented is the evidence collected. A gap - a period when nobody can say where it was - means the possibility cannot be excluded, and the finding is undermined regardless of whether anything actually happened.\n\n' +
          'Each entry records the item, the date and time, the person taking responsibility, the reason for the transfer, and the condition, including hash values.\n\n' +
          'It sounds bureaucratic until you have watched a well-supported conclusion dismissed because nobody recorded a three-day period. The evidence may have been perfectly intact; what cannot be shown is that it was.\n\n' +
          'The same reasoning applies well beyond legal contexts. An audit finding whose supporting data cannot be traced to a source is treated, correctly, as an assertion.',
      },
      {
        lessonId: 'garud-m12-l05',
        title: '12.5 Evidence Documentation',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Contemporaneous notes that let someone else reach the same conclusion.',
        content:
          'Documentation is what converts your analysis into something another person can check.\n\n' +
          'The standard to write to is reproducibility: could a competent person, with your notes and the same evidence, follow your steps and reach your conclusion? That means recording what you did, in what order, with what tool, and what you observed - including the steps that led nowhere. Discarded avenues show the conclusion survived alternatives rather than being the first idea you had.\n\n' +
          'Notes must be contemporaneous. Written afterwards, they record what you remember, which is reliably tidier and more linear than what happened.\n\n' +
          'Keep observation and interpretation visibly separate. "The file was created at 14:32" and "the file was created by the attacker at 14:32" are different claims and only one of them is what you saw.\n\n' +
          'This is the lesson from 11.2 applied with a stricter standard: in an investigation, an unlabelled inference becomes a fact in someone else\'s decision.',
      },
      {
        lessonId: 'garud-m12-l06',
        title: '12.6 Hashing Fundamentals',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'What a hash is, what it proves, and the uses it is wrong for.',
        content:
          'A hash function turns any input into a fixed-length value. The same input always produces the same hash; any change, however small, produces a completely different one; and the hash cannot be reversed to recover the input.\n\n' +
          'Those properties make it an integrity check. Record the hash at acquisition, recompute it later, and matching values demonstrate the data is unchanged. It is also how known files are identified without comparing contents, and how files are deduplicated.\n\n' +
          'Choice of algorithm matters. MD5 and SHA-1 are broken for security purposes: it is feasible to construct two different inputs with the same hash, so a matching hash no longer proves identical content. SHA-256 is the current practical standard.\n\n' +
          'Two common misunderstandings. A hash is not encryption - there is no key and nothing to decrypt. And hashing a password is not sufficient on its own: identical passwords produce identical hashes, so a salt is added to make each one unique, which is why the password lesson specified salted hashes.',
      },
      {
        lessonId: 'garud-m12-l07',
        title: '12.7 Investigation Ethics',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Authority, proportionality, privacy and honesty - the limits that make this work legitimate.',
        content:
          'Investigative capability is intrusive by nature, and what separates an investigator from an intruder is authorisation and restraint.\n\n' +
          'Authority comes first. Establish before you begin that you are permitted to examine this system, this account, this data, and by whom. "I was curious" and "I was trying to help" are not authority. Examining systems you have not been authorised to examine is an offence in most jurisdictions regardless of intent.\n\n' +
          'Proportionality limits scope. An investigation into a specific incident does not license reading everything a person ever wrote. Collect what is relevant to the question.\n\n' +
          'Privacy persists. Evidence will contain personal material irrelevant to the investigation. It is not repeated, not discussed socially, and not retained beyond need.\n\n' +
          'Honesty is the rest. Report what the evidence shows, including where it contradicts what you or others expected, and including where it is inconclusive. Investigators are trusted because their findings are reliable, and that reputation is lost once and permanently.',
      },
    ],
    quizzes: [
      {
        quizId: 'garud-m12-q01',
        title: 'Digital Forensics Fundamentals',
        subject: 'CYBERSECURITY',
        timeLimitMins: 18,
        pointsReward: 70,
        questions: [
          {
            questionId: 'q1',
            question: 'A machine is suspected of compromise and is still running. Which evidence should be collected first?',
            options: [
              'A full disk image',
              'Memory contents and current network connections',
              'The most recent backup',
              'Printed copies of the log files',
            ],
            correctIndex: 1,
            explanation:
              'Order of volatility. Memory and live connections vanish at shutdown; the disk persists. Collect what disappears first or you will have destroyed it by the time you reach it.',
          },
          {
            questionId: 'q2',
            question: 'Why is a file-level copy inadequate for forensic purposes?',
            options: [
              'It takes longer than imaging',
              'It misses deleted content, slack space and metadata - often the parts that matter',
              'It cannot be hashed',
              'It changes the file names',
            ],
            correctIndex: 1,
            explanation:
              'A bit-for-bit image captures the whole storage, including what the file system no longer lists. Deleted-but-not-overwritten content is frequently the evidence.',
          },
          {
            questionId: 'q3',
            question: 'Evidence hashes are recorded at the moment of acquisition. Why not afterwards?',
            options: [
              'Hashing is faster on fresh data',
              'A hash taken after handling only proves nothing changed since the handling',
              'Hashes expire over time',
              'It is a formality with no practical effect',
            ],
            correctIndex: 1,
            explanation:
              'The hash establishes the state at acquisition. Taken later, it cannot exclude changes made between collection and hashing - which is exactly the gap it exists to close.',
          },
          {
            questionId: 'q4',
            question: 'There is a three-day period where nobody recorded who held an evidence drive. What is the consequence?',
            options: [
              'Nothing, provided the hash still matches',
              'The possibility of tampering cannot be excluded, undermining the finding',
              'The evidence must be destroyed',
              'The investigation must restart from the beginning',
            ],
            correctIndex: 1,
            explanation:
              'The evidence may well be intact; what cannot be shown is that it was. A conclusion can be dismissed on a custody gap regardless of whether anything actually happened.',
          },
          {
            questionId: 'q5',
            question: 'Why are MD5 and SHA-1 unsuitable for proving two files are identical?',
            options: [
              'They produce hashes that are too short to store',
              'It is feasible to construct two different inputs with the same hash',
              'They cannot be computed on large files',
              'They are encrypted and need a key',
            ],
            correctIndex: 1,
            explanation:
              'Practical collisions mean a matching hash no longer proves identical content. SHA-256 is the current practical standard for this purpose.',
          },
          {
            questionId: 'q6',
            question: 'Which pair of statements correctly separates observation from interpretation?',
            options: [
              'Both are observations: "the file was created at 14:32" and "the attacker created the file at 14:32"',
              '"The file was created at 14:32" is the observation; "the attacker created it" is the interpretation',
              'Both are interpretations',
              'Neither belongs in an investigation report',
            ],
            correctIndex: 1,
            explanation:
              'The timestamp is what you saw. Attributing it to an attacker is an inference, and an unlabelled inference becomes a fact in somebody else\'s decision.',
          },
          {
            questionId: 'q7',
            question: 'You believe examining a colleague\'s account would help an investigation. What must be established first?',
            options: [
              'That your intent is good',
              'That you have explicit authority to examine that account, and from whom',
              'That the colleague is unlikely to notice',
              'That the investigation is urgent',
            ],
            correctIndex: 1,
            explanation:
              'Authorisation and restraint are what separate an investigator from an intruder. Good intent is not authority, and unauthorised examination is an offence in most jurisdictions regardless of motive.',
          },
        ],
      },
    ],
    tasks: [],
  },
];

export default SECURITY;
