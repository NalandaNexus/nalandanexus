/**
 * YODDHA, months 7-9: incident response, a full investigation case study,
 * leadership under pressure, an integrated simulation, and the final capstone.
 *
 * The last three modules are deliberately cross-subject. A student who can
 * analyse an intrusion but cannot brief an executive, or who can write well but
 * misreads a timestamp, has not completed this stage - and the subject tags on
 * the simulation and final assessment reflect that honestly rather than
 * attributing everything to Cybersecurity.
 */

export const YODDHA_MASTERY = [
  {
    moduleId: 'yoddha-m13',
    title: 'Month 7 · Incident Response',
    order: 13,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m13-l01',
        title: '13.1 Preparation',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'The work done before an incident that determines how the response goes.',
        content:
          'Response quality is decided almost entirely before the incident. Everything done during it is constrained by what was prepared.\n\n' +
          'A plan names who does what, who can authorise disruptive action, and how people are contacted - including out of hours and including when the usual communication systems are the thing that is compromised. A plan stored only on the file server that is currently encrypted is not a plan.\n\n' +
          'Telemetry and retention are preparation, not response. You cannot retroactively collect logs, and the retention decision made quietly last year determines what is knowable now.\n\n' +
          'Access is preparation. Responders need the rights to act quickly, and obtaining emergency access during an incident wastes the hours that matter most.\n\n' +
          'Relationships are preparation: legal counsel, external responders, insurers, law enforcement contacts. Establishing them mid-incident is slow and expensive.\n\n' +
          'And rehearsal. A plan never exercised contains assumptions nobody has tested, and the first real incident is an expensive place to discover them.',
      },
      {
        lessonId: 'yoddha-m13-l02',
        title: '13.2 Identification',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Establishing that something is happening, and what.',
        content:
          'Identification determines what you are dealing with, and it continues throughout - initial understanding is usually incomplete and often partly wrong.\n\n' +
          'Establish the facts before the narrative. What is observed, on which systems, at what times, affecting which accounts. Resist assembling a story early, because the story then directs what you look at and you will find evidence for it.\n\n' +
          'Determine whether it is ongoing. An active intrusion and a historical one need different responses and different urgency.\n\n' +
          'Determine entry point and scope, knowing both estimates will move. The first affected system found is rarely the first affected.\n\n' +
          'Look for what an attacker would have done next. If you find initial access, look for persistence. If you find persistence, look for credential access and lateral movement. Each stage implies the next, and finding one without looking for the others is how responses declare victory prematurely.\n\n' +
          'Record what you have and have not checked. Under pressure this is what prevents duplicated effort and missed ground.',
      },
      {
        lessonId: 'yoddha-m13-l03',
        title: '13.3 Containment',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Short-term and long-term containment, and containing everything at once.',
        content:
          'Containment has two phases. Short-term stops immediate harm - isolate hosts, disable accounts, block addresses. Long-term makes the environment safe to operate while remediation proceeds, which may mean temporary controls, rebuilt systems or restricted access.\n\n' +
          'The strongest principle is simultaneity. Contain everything you know about at once. Sequential containment tells an attacker they are discovered and gives them time to activate access elsewhere, and organisations that contain one host at a time frequently spend weeks chasing an intruder who is always one step ahead.\n\n' +
          'This means delaying containment until scope is understood - accepting ongoing harm to achieve a complete cut. That is a real trade-off requiring a decision by someone with authority, and it should be an explicit decision rather than a default.\n\n' +
          'Account containment must revoke sessions, not only reset passwords. An active session survives a password change.\n\n' +
          'Preserve evidence before containment where you can, and where you cannot, record what was lost and why.',
      },
      {
        lessonId: 'yoddha-m13-l04',
        title: '13.4 Eradication',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Removing the intruder completely, and why partial eradication fails.',
        content:
          'Eradication removes the attacker\'s access and the mechanisms sustaining it. Partial eradication is worse than none, because it produces confidence without safety.\n\n' +
          'Remove every persistence mechanism found, and search for the ones not yet found. An attacker who established access over weeks typically has several, deliberately, precisely to survive this stage.\n\n' +
          'Reset credentials that may have been exposed. Where domain-level credentials were accessible, that may mean everything - an unwelcome, expensive conclusion that is nonetheless the correct one when a domain controller has been compromised.\n\n' +
          'Address the entry point. Eradicating the intrusion without fixing how they arrived means they return through the same door, which is a common and demoralising outcome.\n\n' +
          'Rebuilding is more reliable than cleaning for any system where the attacker had significant access. Cleaning requires knowing everything they did; rebuilding from known-good does not, and the certainty is usually worth the effort.\n\n' +
          'Verify afterwards. Increased monitoring for a period following eradication is how you find out whether it worked.',
      },
      {
        lessonId: 'yoddha-m13-l05',
        title: '13.5 Recovery',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Returning to normal operation safely and in the right order.',
        content:
          'Recovery restores service. Doing it too early reintroduces the compromise; too late causes avoidable business harm.\n\n' +
          'Restore in priority order, driven by business need rather than by technical convenience. Agreeing that order in advance avoids arguing about it during the incident.\n\n' +
          'Validate before returning a system to service: it is rebuilt or verified clean, patched against the entry vector, monitored, and its credentials reset.\n\n' +
          'Restoring from backup carries a specific risk - backups taken during the intrusion may contain the attacker\'s persistence. Establish when the intrusion began, and restore from before it where possible. This is another reason the timeline is not merely documentation.\n\n' +
          'Monitor intensively afterwards. The period immediately following recovery is when an incomplete eradication becomes visible, and it is also when attention naturally relaxes.\n\n' +
          'Communicate restoration accurately. "Systems are back" is heard as "it is over", and if you are still monitoring for reinfection, say so.',
      },
      {
        lessonId: 'yoddha-m13-l06',
        title: '13.6 Lessons Learned',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Making the review produce change rather than a document.',
        content:
          'The review is where an incident becomes an improvement, and it is the stage most often skipped because everyone is exhausted and the crisis has passed.\n\n' +
          'Hold it while memory is fresh, within two weeks. Include everyone who participated, not only leadership.\n\n' +
          'Run it blamelessly and mean it. The objective is to understand how the system allowed this - including the systems of detection, communication and decision-making, not only the technical ones.\n\n' +
          'Examine the response as rigorously as the incident. What delayed detection? What delayed the decision to contain? What information was needed and unavailable? These frequently yield more improvement than the technical entry point.\n\n' +
          'Produce owned actions with dates. "Improve monitoring" is not an action. "Enable process-creation logging on all servers, owner X, by date Y" is.\n\n' +
          'Follow up. Unactioned findings are how the same incident recurs with a fuller paper trail, and the follow-up is what distinguishes a learning organisation from one that documents its repetitions.',
      },
      {
        lessonId: 'yoddha-m13-l07',
        title: '13.7 Incident Documentation and Handover',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Records that survive the incident, and shift handover that does not lose ground.',
        content:
          'A significant incident outlasts anyone\'s ability to work continuously, so handover quality determines whether progress compounds or restarts.\n\n' +
          'A handover states: current status, what is confirmed, what is suspected, what actions are in progress and who owns them, what has been checked and found clean, and what is queued. The "checked and clean" list is the part most often omitted and the most valuable - without it the next shift re-checks what you already cleared.\n\n' +
          'Hand over verbally as well as in writing. Context that has not been written down always exists, and five minutes of conversation transfers it.\n\n' +
          'Maintain one authoritative record throughout, not per-shift notes.\n\n' +
          'At the end, produce the final documentation while it is fresh: the timeline, what was found, what was done, what was lost, and what remains uncertain. This becomes the reference for the review, for any regulatory or legal process, and for the next incident - which will benefit disproportionately from an accurate account of this one.',
      },
    ],
    quizzes: [
      {
        quizId: 'yoddha-m13-q01',
        title: 'Incident Response Assessment',
        subject: 'CYBERSECURITY',
        timeLimitMins: 20,
        pointsReward: 80,
        questions: [
          {
            questionId: 'q1',
            question: 'You have found three compromised hosts and suspect more. Why might containing the three immediately be the wrong move?',
            options: [
              'Containment is always wrong before eradication',
              'It warns the attacker, who may activate access elsewhere - simultaneous containment of full scope is usually better',
              'Containment destroys all evidence',
              'Three hosts is below the threshold for action',
            ],
            correctIndex: 1,
            explanation:
              'Sequential containment lets an intruder stay a step ahead. Delaying to achieve a complete cut accepts ongoing harm, which is why it is an explicit decision by someone with authority.',
          },
          {
            questionId: 'q2',
            question: 'An account is believed compromised. The password is reset. Why may the attacker still have access?',
            options: [
              'Password resets take 24 hours to apply',
              'An existing authenticated session survives a password change unless sessions are revoked',
              'The attacker knows the new password automatically',
              'Password resets do not apply to service accounts',
            ],
            correctIndex: 1,
            explanation:
              'Session revocation is the part routinely forgotten, and it is what actually ends the access.',
          },
          {
            questionId: 'q3',
            question: 'Why is restoring from a backup taken during the intrusion window risky?',
            options: [
              'Backups are always corrupted',
              'The backup may contain the attacker\'s persistence mechanisms',
              'Restoring resets all passwords',
              'Backups cannot be verified',
            ],
            correctIndex: 1,
            explanation:
              'Restoring reintroduces whatever was present when the backup was taken - which is another reason establishing when the intrusion began is operational rather than merely documentary.',
          },
          {
            questionId: 'q4',
            question: 'You find initial access on a host. What should you look for next?',
            options: [
              'Nothing - the entry point is the finding',
              'Persistence, then credential access and lateral movement, because each stage implies the next',
              'Only the antivirus logs',
              'The user\'s browser history exclusively',
            ],
            correctIndex: 1,
            explanation:
              'Finding one stage without looking for the others is how responses declare victory prematurely, leaving the intruder in place.',
          },
          {
            questionId: 'q5',
            question: 'Why is rebuilding a significantly compromised system usually preferred to cleaning it?',
            options: [
              'Rebuilding is always faster',
              'Cleaning requires knowing everything the attacker did; rebuilding from known-good does not',
              'Cleaning voids the hardware warranty',
              'Rebuilding preserves more evidence',
            ],
            correctIndex: 1,
            explanation:
              'The certainty is what you are buying. Cleaning leaves you relying on having found everything, which is exactly the assumption an attacker with several persistence mechanisms is counting on.',
          },
          {
            questionId: 'q6',
            question: 'Which part of a shift handover is most often omitted and most valuable?',
            options: [
              'The current severity rating',
              'What has been checked and found clean',
              'The incident start time',
              'The name of the detection tool',
            ],
            correctIndex: 1,
            explanation:
              'Without it, the next shift re-checks ground you already cleared, and the response makes no net progress across the handover.',
          },
          {
            questionId: 'q7',
            question: 'A lessons-learned review produces the action "be more vigilant". What is wrong with it?',
            options: [
              'Nothing - awareness is important',
              'It is a wish, not a change: real outcomes are a check added, a permission narrowed, or information made visible',
              'It should be assigned to the whole team',
              'It should have been raised during the incident',
            ],
            correctIndex: 1,
            explanation:
              'Actions need an owner, a date and a concrete change. Reviews that end in exhortation are how the same incident recurs with a fuller paper trail.',
          },
        ],
      },
    ],
    tasks: [],
  },

  {
    moduleId: 'yoddha-m14',
    title: 'Month 7 · Investigation Case Study',
    order: 14,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m14-l01',
        title: '14.1 The Aurelia Case: Briefing',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'A complete intrusion to investigate, with the ambiguity left in.',
        content:
          'BRIEFING. Aurelia Health Systems provides scheduling software to clinics. On Friday 17th, a clinic reported that appointment records for another clinic were visible in their portal. Aurelia confirmed the fault and disabled the affected feature the same day.\n\n' +
          'On Monday 20th, a security researcher contacted Aurelia stating that a database extract appearing to contain Aurelia customer data had been offered for sale on a forum two weeks earlier. The researcher provided a sample of 40 records. Aurelia confirmed the records are genuine and are from their production database.\n\n' +
          'The visible-records fault and the extract may or may not be related. Establishing that is part of the work.\n\n' +
          'YOU ARE AUTHORISED to examine Aurelia\'s application logs, database audit logs, infrastructure logs and staff accounts. You are not authorised to contact the researcher directly, to access the forum, or to examine clinic-side systems.\n\n' +
          'YOUR QUESTIONS: how was data obtained, when, how much, is the access still available, and are the two events connected?\n\n' +
          'Over the next two lessons you receive the evidence. Some of it is misleading, and part of the exercise is establishing which.',
      },
      {
        lessonId: 'yoddha-m14-l02',
        title: '14.2 The Aurelia Case: Evidence',
        duration: '26 mins',
        subject: 'CYBERSECURITY',
        summary: 'The evidence package, including the parts that do not fit.',
        content:
          'APPLICATION LOGS (UTC). The portal logs each API request with account, endpoint and response code.\n' +
          '  Mar 02 04:12-06:48  account clinic_4471, endpoint /api/appointments?clinicId=N — 84,000 requests, clinicId incrementing from 1 to 84,000, all HTTP 200\n' +
          '  Mar 02 06:48        requests stop\n' +
          '  Mar 14 09:31        account clinic_2210 reports seeing another clinic\'s records (the Friday 17th report refers to this earlier ticket)\n\n' +
          'DATABASE AUDIT LOG (UTC+2, clock verified correct):\n' +
          '  Mar 02 06:15  bulk read, 84,000 rows, by application service account (the account the portal itself uses)\n' +
          '  Mar 09 23:50  bulk read, 84,000 rows, by application service account\n\n' +
          'INFRASTRUCTURE (UTC):\n' +
          '  Mar 02 04:09  clinic_4471 authenticated from 198.51.100.31 (registered clinic address: 203.0.113.12)\n' +
          '  Mar 09 23:44  admin_ops authenticated from 198.51.100.31\n' +
          '  Mar 09 23:58  admin_ops created API token "reporting-integration", no expiry\n\n' +
          'ALSO KNOWN: the /api/appointments endpoint checked that the caller was authenticated. It did not check that the caller was entitled to the clinicId requested. That defect was introduced in a release on Feb 27 and fixed on Mar 17. admin_ops is a shared administrative account used by three staff, with no MFA. The API token created on Mar 09 is still active.\n\n' +
          'NOTE CAREFULLY: the database audit log is in UTC+2. One of the two bulk reads does not correspond to the application activity, and explaining that discrepancy is central.',
      },
      {
        lessonId: 'yoddha-m14-l03',
        title: '14.3 The Aurelia Case: What to Establish',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'The specific determinations this case requires, and their traps.',
        content:
          'Work this case with the discipline of the whole stage. Several traps are deliberately present.\n\n' +
          'The timezone trap. The database log is UTC+2. Converted, the Mar 02 06:15 entry is 04:15 UTC - inside the enumeration window, not after it. The Mar 09 entry converts to 21:50 UTC, which is before the admin_ops login at 23:44. That ordering matters enormously.\n\n' +
          'The attribution trap. Two different accounts were used from the same address. That connects the events strongly but does not identify a person, and admin_ops is shared by three staff with no MFA.\n\n' +
          'The vulnerability trap. The broken access control explains how appointment data could be read through the portal. It does not obviously explain a second bulk read a week later, and the temptation is to attribute everything to the first cause.\n\n' +
          'The still-open question. An API token with no expiry, created during the incident window, remains active. Whether that is still live access is one of your stated questions.\n\n' +
          'And the connection question. The visible-records fault and the sale are both consequences of the same defect - but establishing that requires showing the mechanism, not asserting it.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'yoddha-m14-a01',
        title: 'Aurelia Case — Full Investigation',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 110,
        dueOffsetDays: 21,
        iconName: 'FileSearch2',
        description:
          'Investigate the Aurelia case completely, using only the supplied evidence.\n\n' +
          '1. TIMELINE. Normalise every entry to UTC, stating the conversion you applied to the database log. Each entry must carry its source.\n\n' +
          '2. ANALYSE THE EVIDENCE. For each item: what it shows, what it does not show, and your confidence.\n\n' +
          '3. IDENTIFY THE INDICATORS. List them and explain why each is an indicator. Address specifically: the incrementing clinicId pattern, the source address appearing under two accounts, and the token with no expiry.\n\n' +
          '4. BUILD THE TIMELINE OF THE INTRUSION. What happened, in order, marking each step as evidenced or inferred. You must account for BOTH bulk reads - explain why the second one is not explained by the portal enumeration, and what the evidence suggests instead.\n\n' +
          '5. EXPLAIN FINDINGS. Answer the five briefing questions: how, when, how much, is access still available, and are the two events connected. Where the evidence does not settle a question, say so precisely.\n\n' +
          '6. ATTRIBUTION. State exactly what the evidence supports about who did this. Address the shared admin_ops account explicitly and explain why this limits attribution regardless of how strong the technical picture is.\n\n' +
          '7. INVESTIGATION REPORT. A complete report: one-page non-technical summary; findings with confidence; what could not be determined and why; and ranked recommendations. At least one recommendation must address the shared account and one must address the still-active token as an immediate action.\n\n' +
          'Assessed on: whether the timezone conversion is performed and its consequence understood; whether you resist attributing the second bulk read to the first cause; whether attribution is handled with the care a shared account demands; and whether the still-open access is identified as urgent rather than historical.',
      },
    ],
  },

  {
    moduleId: 'yoddha-m15',
    title: 'Month 8 · Cyber Leadership',
    order: 15,
    subject: 'ENGLISH',
    lessons: [
      {
        lessonId: 'yoddha-m15-l01',
        title: '15.1 Security Team Leadership',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Leading specialists, managing burnout, and sustaining attention.',
        content:
          'Security teams have characteristic pressures, and leading one means managing those rather than only the work.\n\n' +
          'The work is adversarial and unbounded - there is always more that could be done, and the standard of "enough" is never met. Without a leader who defines enough, people work until they break.\n\n' +
          'Alert fatigue is an operational risk, not a wellbeing footnote. An analyst who has processed four hundred alerts is measurably worse at the four hundred and first, and the organisation depends on that judgement.\n\n' +
          'On-call arrangements must be survivable. A rota where one person is permanently reachable produces a person who leaves.\n\n' +
          'Specialists need autonomy and they need direction. The failure at one extreme is micromanaging people who know more than you about their area; at the other, abdicating so that priorities are set by whoever shouts.\n\n' +
          'Protect the team from the organisation where necessary. Absorbing pressure and translating it into achievable work is a substantial part of the job.',
      },
      {
        lessonId: 'yoddha-m15-l02',
        title: '15.2 Incident Leadership',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Commanding a response: deciding, coordinating, and not doing the technical work.',
        content:
          'During an incident someone must hold the whole picture, and that person cannot simultaneously be investigating.\n\n' +
          'The incident lead\'s job is to decide, coordinate, and communicate. The most common failure is a technically strong lead who is drawn into hands-on analysis, after which nobody is holding the picture and the response fragments.\n\n' +
          'Decide at the right pace. Reversible actions - isolating a host - are taken quickly on suspicion. Irreversible ones - rebuilding, resetting all credentials, notifying externally - deserve deliberation and usually a decision above your level.\n\n' +
          'Keep one record, run regular briefings even when there is nothing new, and explicitly assign every workstream an owner. Work not assigned to a named person is not being done.\n\n' +
          'Manage the organisation as well as the incident. Executives will want updates continuously, and shielding responders from that demand while keeping leadership genuinely informed is a real and difficult part of the role.\n\n' +
          'Enforce rest on long incidents. A responder on hour fourteen makes mistakes that create new incidents.',
      },
      {
        lessonId: 'yoddha-m15-l03',
        title: '15.3 Decision Making Under Uncertainty',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Deciding on incomplete information, and being judged in hindsight.',
        content:
          'Security decisions are made with incomplete information and judged with complete information. That asymmetry is worth understanding before you are on the receiving end of it.\n\n' +
          'Decide on expected consequence rather than on certainty. "We do not know whether data left, so we will prepare for notification while continuing to investigate" is stronger than waiting for proof.\n\n' +
          'Distinguish reversible from irreversible. This distinction does more work than any other in practice.\n\n' +
          'State what would change your mind. It converts a position into a hypothesis, and makes changing course a normal outcome rather than an admission.\n\n' +
          'Record the decision, the reasoning, and what was known at the time - contemporaneously. Reviews are conducted by people who know how it turned out, and hindsight makes every decision look obvious. A contemporaneous record is your only defence, and more importantly it is the only way the organisation can actually learn whether the process was sound.\n\n' +
          'Accept that some well-made decisions have bad outcomes. Judging decisions by outcome alone produces decision-makers who optimise for defensibility rather than for being right.',
      },
      {
        lessonId: 'yoddha-m15-l04',
        title: '15.4 Risk Communication',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'Conveying risk to people who must weigh it against other risks.',
        content:
          'Executives weigh security risk against commercial, operational and regulatory risk. Communicating it in terms that cannot be compared makes it impossible to weigh.\n\n' +
          'Translate into their terms: cost, operational disruption, regulatory exposure, reputational harm. A severity score is not comparable to a revenue forecast; a statement that a breach of this system would be reportable and would halt bookings for two days is.\n\n' +
          'Give likelihood honestly, including when it is low. Presenting every risk as imminent is a short-term tactic that permanently discounts your assessments.\n\n' +
          'Present options with costs and residual risk, and recommend one. "We can do nothing, accepting this risk; spend this to reduce it to that; or spend more for this. I recommend the second because..." is a decision-ready framing.\n\n' +
          'Record accepted risks with who accepted them and when. This is not defensive paperwork - it is how the organisation knows what it has chosen to live with, and it is what makes the choice revisitable when circumstances change.\n\n' +
          'Never inflate to force a decision. It works once.',
      },
      {
        lessonId: 'yoddha-m15-l05',
        title: '15.5 Executive Reporting',
        duration: '22 mins',
        subject: 'ENGLISH',
        summary: 'Regular reporting that informs rather than reassures.',
        content:
          'Executive security reporting fails in two directions: an unreadable wall of metrics, or reassurance that conveys nothing.\n\n' +
          'Report on outcomes and trends rather than activity. "We blocked 4 million emails" is activity and means nothing without context. "Median time to detect fell from 9 days to 2; three incidents this quarter, none involving data loss; our biggest current gap is X" is a report someone can act on.\n\n' +
          'Include what is not going well. A report that is always green trains the reader to ignore it, and makes the first red report far more alarming than it should be.\n\n' +
          'Be consistent so trends are visible. Changing the metrics each quarter prevents comparison, which is usually the point of reporting.\n\n' +
          'Connect to decisions. Reporting that requires no action from the reader will eventually not be read. If you need investment, a decision, or an accepted risk acknowledged, the report is where it belongs.\n\n' +
          'Keep it short. A one-page report that is read beats a twenty-page report that is filed.',
      },
      {
        lessonId: 'yoddha-m15-l06',
        title: '15.6 Crisis Management',
        duration: '24 mins',
        subject: 'ENGLISH',
        summary: 'Leading when the organisation, not just the systems, is in trouble.',
        content:
          'A crisis is an incident that has become an organisational event: operations disrupted, customers affected, regulators and media involved.\n\n' +
          'Structure matters more here than at any other time. Separate technical response, business continuity, communications and legal, with a single coordinating point. Without that, executives make technical decisions and responders make communications decisions, and both go badly.\n\n' +
          'Establish the rhythm early: scheduled briefings, one record, one voice externally. Ad hoc communication during a crisis produces contradictions that become the story.\n\n' +
          'Protect the responders. A crisis generates enormous demand for updates, and unmanaged, that demand consumes the people who are meant to be fixing it.\n\n' +
          'Prepare for duration. Serious crises last weeks, not days, and arrangements sustainable for 48 hours are not sustainable for three weeks. Plan shifts and enforce them from the start, not once people are already exhausted.\n\n' +
          'Be honest publicly. Organisations recover from incidents; they recover much less well from having been evasive about them.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'yoddha-m15-a01',
        title: 'Executive Cybersecurity Briefing',
        type: 'Task',
        subject: 'ENGLISH',
        urgency: 'high',
        pointsReward: 90,
        dueOffsetDays: 18,
        iconName: 'Presentation',
        description:
          'Brief a board on the Aurelia incident and what should follow. You are the incident lead.\n\n' +
          'THE SITUATION. Your investigation established the broken access control, the enumeration, the exposure of appointment data for approximately 84,000 records including patient names and appointment times, the shared administrative account, and an API token that remained active for eleven days after the incident began. Notification obligations are being assessed by legal. Two clinics have asked whether they should tell their patients.\n\n' +
          'PRODUCE:\n' +
          '1. A board paper of no more than two pages. It must open with the position and the decisions required, express impact in terms a board weighs - regulatory, operational, reputational, financial - and state clearly what remains uncertain.\n' +
          '2. Three options with cost, what each achieves, and the residual risk of each. Recommend one and justify it.\n' +
          '3. A statement of the risks you are asking the board to formally accept, if any.\n' +
          '4. A ten-minute presentation outline, with your opening two sentences written verbatim.\n' +
          '5. Written answers to: "Could this have been prevented?"; "Can you guarantee it is over?"; "Should we tell patients before we are legally required to?"; and "Who is accountable for this?"\n\n' +
          'The last question is the difficult one. Answer it in a way that is honest about cause without scapegoating an individual, and that does not evade the question either.\n\n' +
          'Assessed on: whether a board could decide from your paper alone; whether impact is genuinely translated rather than restated technically; whether uncertainty is stated rather than smoothed; and whether your answer on accountability is both honest and fair.',
      },
    ],
  },

  {
    moduleId: 'yoddha-m16',
    title: 'Month 8 · Integrated Security Simulation',
    order: 16,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m16-l01',
        title: '16.1 The Simulation: Setup',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'A live-paced exercise where information arrives over time and decisions cannot wait.',
        content:
          'This simulation differs from the case studies in one way that changes everything: information arrives in stages, and you make decisions before the next stage arrives. You cannot read ahead, and you will make at least one decision you would make differently with the later information. That is the point.\n\n' +
          'YOUR ROLE. You are the incident lead at Kestrel Logistics, 900 staff, operating warehouses that run 24 hours. You have two analysts available and access to an external responder under a retainer that requires an executive to authorise the spend.\n\n' +
          'WHAT IS AT STAKE. The warehouse management system controls dispatch. If it stops, deliveries stop within about four hours. The finance system holds supplier payment details. The HR system holds staff records including bank details.\n\n' +
          'HOW TO WORK IT. For each stage you record: what you now believe, what you decide, and why - before reading the next stage. Then you record, afterwards, what you would have done differently and at what point you could have known.\n\n' +
          'Honest self-assessment is assessed here. A student who claims every decision was correct has not understood the exercise.',
      },
      {
        lessonId: 'yoddha-m16-l02',
        title: '16.2 The Simulation: Stages One to Three',
        duration: '26 mins',
        subject: 'CYBERSECURITY',
        summary: 'The first three information drops. Decide at each before reading on.',
        content:
          'STAGE 1 — Tuesday 14:20. A warehouse supervisor reports that three staff received an email from "IT Support" asking them to re-authenticate. One clicked and entered credentials. She does not know who. There is no MFA on email.\n' +
          'DECIDE: what do you do in the next fifteen minutes, and what do you need to know?\n\n' +
          'STAGE 2 — Tuesday 15:05. You establish that 31 staff received the message. Email logs show 4 clicked the link. One of the four is a warehouse systems administrator. Her account shows a successful login at 14:31 from an address in another country, and a mailbox rule created at 14:33 moving messages containing "security" or "password" to a hidden folder.\n' +
          'DECIDE: severity, containment actions and their order, who you inform, and whether you invoke the external retainer.\n\n' +
          'STAGE 3 — Tuesday 16:40. The administrator\'s account was used at 15:58 to access the warehouse management system and create a new administrative user. Dispatch is running normally. Your analyst reports the finance system shows no unusual access. A second analyst notes that the warehouse system\'s own logs are retained for 3 days.\n' +
          'DECIDE: do you disable the warehouse system\'s new admin account immediately, given that a mistake here could stop dispatch? What do you preserve first, given the 3-day retention? What do you tell the operations director?',
      },
      {
        lessonId: 'yoddha-m16-l03',
        title: '16.3 The Simulation: Stages Four and Five',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'The situation develops, including a complication that tests your earlier choice.',
        content:
          'STAGE 4 — Tuesday 19:15. You contained the administrator\'s account at 16:55. At 19:10 a different account - a finance clerk who did not click the link - authenticated from the same foreign address. The mailbox rule on the administrator\'s account had been in place long enough to hide a password-reset notification. Your containment did not include a review of what that account had accessed while compromised, and it had opened a shared credentials spreadsheet at 15:12.\n' +
          'DECIDE: what does this change about scope? What do you do about the spreadsheet? Was your containment at 16:55 adequate, and what would have made it so?\n\n' +
          'STAGE 5 — Wednesday 02:40. Dispatch has slowed. The night supervisor reports the warehouse system is "sluggish". Your on-call analyst finds the new administrative account from Stage 3 was used at 01:50 to run a bulk export of the dispatch database. The export is 4.2 GB and a flow record shows 3.9 GB transferred outbound between 02:05 and 02:35.\n' +
          'DECIDE: immediate actions; whether you now stop the warehouse system knowing dispatch fails within four hours; who you wake; and whether this is now a crisis rather than an incident.\n\n' +
          'Then write your retrospective: the decision you would change, and the stage at which you could have known.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'yoddha-m16-a01',
        title: 'Integrated Security Simulation — Response Record',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 110,
        dueOffsetDays: 18,
        iconName: 'Activity',
        description:
          'Work the Kestrel simulation stage by stage and submit your complete response record.\n\n' +
          'FOR EACH OF THE FIVE STAGES, recorded before reading the next:\n' +
          '  a. What you believe is happening - confirmed and suspected, separately.\n' +
          '  b. Your severity classification and the criteria behind it.\n' +
          '  c. Your decisions and actions, in order, with the trade-off accepted at each.\n' +
          '  d. What you preserve, and what you accept losing.\n' +
          '  e. Who you inform and what you tell them.\n' +
          '  f. The three things you most need to know next.\n\n' +
          'THEN SUBMIT:\n' +
          '1. A normalised incident timeline across all five stages.\n' +
          '2. A retrospective identifying at least two decisions you would change, the stage at which the information to decide better was available, and what would have had to be different for you to have used it.\n' +
          '3. An answer to the Stage 5 question in full: stopping the warehouse system stops dispatch within four hours. Argue your decision either way, including who has the authority to make it and what you would tell them.\n' +
          '4. Three preparation failures at Kestrel that made this response harder, each with the control that would fix it. At least one must concern retention and one must concern the shared credentials spreadsheet.\n' +
          '5. A 200-word update written as you would have sent it to the executive team at Stage 5, at 03:00.\n\n' +
          'Assessed on: whether decisions were genuinely made before later information was available; whether confirmed and suspected are kept apart under time pressure; whether the Stage 4 containment gap is recognised honestly; and whether the retrospective is candid rather than self-justifying.',
      },
    ],
  },

  {
    moduleId: 'yoddha-m17',
    title: 'Month 9 · Final Investigation',
    order: 17,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m17-l01',
        title: '17.1 Final Capstone: The Brief',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'The substantial investigation that concludes YODDHA.',
        content:
          'This is the final piece of work in the Nalanda Nexus journey. It is deliberately larger and less guided than anything before it.\n\n' +
          'THE ORGANISATION. Vantor Manufacturing, 1,400 staff, four sites. Produces industrial components. Holds design files representing years of engineering investment, an ERP system, and staff records.\n\n' +
          'THE TRIGGER. A competitor has launched a product closely resembling a Vantor design that had not been released. Vantor\'s legal team believes design files were taken. The board has commissioned an investigation.\n\n' +
          'YOUR AUTHORITY. You may examine Vantor systems, logs and company accounts. You may not examine personal devices, personal email, or anything belonging to the competitor. You must assume your findings may be examined in legal proceedings, which raises the standard for evidence handling and for the precision of what you assert.\n\n' +
          'THE QUESTIONS. Were design files taken? If so, which, when, and by what route? Is the access still available? Can the activity be attributed, and to what standard?\n\n' +
          'The evidence package follows. Like real evidence it is incomplete, partly contradictory, and includes material that turns out to be irrelevant.',
      },
      {
        lessonId: 'yoddha-m17-l02',
        title: '17.2 Final Capstone: The Evidence Package',
        duration: '28 mins',
        subject: 'CYBERSECURITY',
        summary: 'Everything you have, including what is missing and why.',
        content:
          'FILE SERVER AUDIT (UTC). Design repository \\\\VAN-FS-02\\designs:\n' +
          '  Jan 08 18:42  read, 1,240 files, user m.okafor (engineering)\n' +
          '  Jan 15 19:05  read, 1,240 files, user m.okafor\n' +
          '  Jan 22 18:51  read, 1,240 files, user m.okafor\n' +
          '  Jan 29 19:12  read, 1,240 files, user m.okafor\n' +
          '  (pattern continues weekly through Mar 26)\n\n' +
          'ENDPOINT (VAN-LT-204, assigned to m.okafor):\n' +
          '  Removable device connected: Jan 08 18:40, Jan 15 19:02, Jan 22 18:49, weekly thereafter. Same device serial each time.\n' +
          '  Execution artefact: 7z.exe, run count 12, first Jan 08 18:44, last Mar 26 19:20\n' +
          '  Browser: no uploads to file-sharing sites recorded. Proxy logs retained 30 days; analysis begins Apr 14.\n\n' +
          'HR RECORDS: m.okafor, senior design engineer, 9 years service. Resigned Mar 28, last day Apr 11, joined a competitor Apr 14. Performance record unremarkable. Raised a grievance about a promotion decision in December.\n\n' +
          'ALSO KNOWN: engineering staff routinely work evenings during release cycles. m.okafor\'s role legitimately requires access to the full design repository. Vantor has no data loss prevention. The weekly read pattern also appears in the logs of two other engineers, though without the removable-device correlation. Vantor\'s acceptable-use policy prohibits copying design files to personal media; staff acknowledge it annually.\n\n' +
          'NOT AVAILABLE: the removable device itself; proxy logs before Mar 15; any record of what was written to the device.',
      },
      {
        lessonId: 'yoddha-m17-l03',
        title: '17.3 Final Capstone: Standard of Proof',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'What this evidence can and cannot establish about a named person.',
        content:
          'This case turns on a distinction the whole stage has been building towards, and getting it wrong here would harm a real person.\n\n' +
          'WHAT THE EVIDENCE SUPPORTS. That an account read the full design repository weekly, that a removable device was connected to that account\'s assigned laptop minutes before each read, that an archiving tool ran on the same evenings, and that this pattern coincided with a period ending shortly before resignation to a competitor.\n\n' +
          'WHAT IT DOES NOT ESTABLISH. That files were written to the device - there is no record of writes. That the files taken, if any, were the ones the competitor used. That the person was at the keyboard. And it does not establish motive; the December grievance is context, not evidence, and presenting it as evidence of intent would be improper.\n\n' +
          'THE EXCULPATORY MATERIAL MATTERS. Two other engineers show the same read pattern. The access was legitimate for the role. Evening work is normal. An investigation that omits these has not been conducted honestly, and a competent opposing examiner will find them.\n\n' +
          'Your report must be precise enough that a reader cannot mistake a strong circumstantial pattern for proof - while also not underselling a pattern that plainly warrants action.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'yoddha-final-capstone',
        title: 'YODDHA Final Capstone — Investigation, Report and Defence',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 300,
        dueOffsetDays: 30,
        iconName: 'Award',
        description:
          'The final piece of the Nalanda Nexus journey. Eight parts, submitted together.\n\n' +
          'PART 1 — EVIDENCE IDENTIFICATION. Every item, what it is, what it could establish, and its limitations. Plus everything missing and the consequence of each absence.\n\n' +
          'PART 2 — TIMELINE. Normalised, sourced, with the weekly pattern established and the relationship between device connection, archiving-tool execution and repository read shown precisely.\n\n' +
          'PART 3 — TECHNICAL ANALYSIS. What the artefacts mean individually and together. Address specifically: why the device-then-archive-then-read sequence is more significant than any element alone, and what the absence of write records means for your conclusions.\n\n' +
          'PART 4 — FINDINGS. Each with a confidence level and its supporting evidence. You must include the exculpatory material: the two other engineers with the same read pattern, the legitimacy of the access, and normal evening working. State how each affects your confidence.\n\n' +
          'PART 5 — RISK ASSESSMENT. What Vantor has lost or may have lost, what remains at risk, and what the uncertainty means commercially and legally.\n\n' +
          'PART 6 — RECOMMENDATIONS. Ranked, each naming the control and what it would have prevented or revealed. Include both immediate actions and structural changes. At least one must address the absence of any record of writes to removable media.\n\n' +
          'PART 7 — PROFESSIONAL FINAL REPORT. A standalone document written to a standard that could be examined in proceedings. One-page summary; findings; an attribution section that is precise about the difference between account activity and personal action; limitations; recommendations. It must be readable by a non-technical director and survive scrutiny by a hostile technical expert.\n\n' +
          'PART 8 — DEFENCE. A presentation of no more than ten minutes, plus written answers to: "Is m.okafor responsible?"; "Why can you not prove the files were copied?"; "Two other engineers did the same thing - why are they not suspects?"; "The grievance shows motive, doesn\'t it?"; and "What should we have done differently?"\n\n' +
          'ASSESSED ACROSS ALL THREE SUBJECTS. Cybersecurity: the analysis, the handling of evidence, the recommendations. Computer: correct reading of artefacts, timestamps, logs and system behaviour. English: whether the report and defence would hold up with their real audiences.\n\n' +
          'The single most important criterion is the handling of attribution. A report that asserts more than the evidence supports fails regardless of how good the rest is - and so does one that is so hedged it tells the board nothing.',
      },
    ],
  },

  {
    moduleId: 'yoddha-m18',
    title: 'Month 9 · YODDHA Final Assessment',
    order: 18,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m18-l01',
        title: '18.1 What the Final Assessment Covers',
        duration: '18 mins',
        subject: 'ENGLISH',
        summary: 'The scope of the final assessment and how it is weighted.',
        content:
          'The YODDHA final assessment covers the full stage and is deliberately cross-subject, because the work it prepares you for does not separate them.\n\n' +
          'English: technical communication, executive and risk communication, report writing, handling hostile questions, and the precision of language around attribution and confidence.\n\n' +
          'Computer: systems at depth - processes, memory, persistence, privilege - networking, scripting and automation, and system analysis.\n\n' +
          'Cybersecurity: security operations, detection engineering, digital forensics, incident response, investigation method, defensive security and vulnerability management.\n\n' +
          'Questions are mixed. Some test recall. Many present a situation and ask what you would conclude or do - in several of those more than one answer is defensible, and the reasoning is what is assessed.\n\n' +
          'There is a deliberate emphasis on judgement under uncertainty, on the limits of evidence, and on the difference between what a technical artefact shows and what it proves. If you have understood those three things, the rest follows.',
      },
    ],
    quizzes: [
      {
        quizId: 'yoddha-final-assessment',
        title: 'YODDHA Final Assessment',
        subject: 'CYBERSECURITY',
        timeLimitMins: 60,
        pointsReward: 250,
        questions: [
          {
            questionId: 'q1',
            question: 'An account shows activity consistent with data theft, but the account is shared by three staff and has no MFA. What can your report properly assert?',
            options: [
              'That all three staff are responsible',
              'That the account was used for the activity, and that attribution to an individual is not possible on this evidence',
              'That the most senior of the three is responsible',
              'Nothing at all can be asserted',
            ],
            correctIndex: 1,
            explanation:
              'Account activity is not personal action. Stating the technical finding precisely while naming the attribution limit is both honest and still useful.',
          },
          {
            questionId: 'q2',
            question: 'A database audit log is in UTC+2 and the application log in UTC. You correlate them without converting. What is the risk?',
            options: [
              'Some entries will be missing',
              'Events will appear in the wrong order, producing a coherent and entirely incorrect reconstruction',
              'The logs will fail to parse',
              'Only the durations will be wrong',
            ],
            correctIndex: 1,
            explanation:
              'This is the most dangerous class of investigative error, because nothing about the result looks wrong.',
          },
          {
            questionId: 'q3',
            question: 'Which indicator type survives an attacker changing infrastructure?',
            options: [
              'A file hash',
              'A behavioural indicator, such as a document process spawning a shell',
              'A command-and-control IP address',
              'A domain name',
            ],
            correctIndex: 1,
            explanation:
              'Atomic indicators are cheap and easily evaded. Behavioural indicators require the attacker to change their method, which is far more expensive.',
          },
          {
            questionId: 'q4',
            question: 'You contain one compromised host while suspecting others. What is the principal risk?',
            options: [
              'The host may not restart cleanly',
              'The attacker is warned and may activate access elsewhere or destroy evidence',
              'Containment logs are unreliable',
              'Other hosts will automatically be contained too',
            ],
            correctIndex: 1,
            explanation:
              'Simultaneous containment of known scope is usually better, which means accepting ongoing harm while scope is established - an explicit decision, not a default.',
          },
          {
            questionId: 'q5',
            question: 'An endpoint agent is deployed everywhere but is in monitor-only mode on 40% of devices. Which validation level did the organisation fail?',
            options: [
              'Existence - it was not deployed',
              'Configuration - it was deployed but not configured as intended',
              'Effectiveness - it was configured but did not detect',
              'None - monitor-only is an acceptable configuration',
            ],
            correctIndex: 1,
            explanation:
              'Most organisations validate existence and assume the rest. This is exactly how a control everyone believed was protecting them turns out not to have been.',
          },
          {
            questionId: 'q6',
            question: 'A script processing a log file silently skips lines it cannot parse. Why is this dangerous in an investigation?',
            options: [
              'It makes the script slower',
              'The unusual entries you are looking for are the most likely to be malformed, and you will never know they were excluded',
              'It corrupts the input file',
              'It prevents the script from being scheduled',
            ],
            correctIndex: 1,
            explanation:
              'Counting and reporting skipped lines is what makes the result honest. Silent exclusion produces an analysis that is quietly incomplete.',
          },
          {
            questionId: 'q7',
            question: 'A file\'s metadata-change time is later than its creation time with no copy or restore to explain it. What does this suggest?',
            options: [
              'The file is corrupt',
              'Timestamps may have been manipulated - the metadata-change time is not settable through ordinary interfaces',
              'The file was created on another operating system',
              'Nothing - this is always normal',
            ],
            correctIndex: 1,
            explanation:
              'Timestamps are analysed as a set; internal inconsistency is the signal. But it is a lead requiring corroboration, not a conclusion.',
          },
          {
            questionId: 'q8',
            question: 'Your correlation rule would have fired 200 times last month against historical data. What does this tell you?',
            options: [
              'The environment is heavily compromised',
              'It is not a detection - it needs tuning before it is enabled, or it will destroy trust in the alert stream',
              'The rule is working correctly',
              'The historical data is unreliable',
            ],
            correctIndex: 1,
            explanation:
              'Testing against history before enabling is what prevents a rule that will be ignored within a week - and ignored on the day it is right.',
          },
          {
            questionId: 'q9',
            question: 'A remediation plan lists 40 findings in severity order. What is the main problem?',
            options: [
              'Severity order is always wrong',
              'It is a list, not a plan - it ignores dependencies, resource limits and the fact that some fixes enable others',
              'Forty findings is too many to report',
              'Low-severity findings should be omitted',
            ],
            correctIndex: 1,
            explanation:
              'Asset inventory precedes patching coverage; central logging precedes detection. Working strictly by severity produces work that must be redone.',
          },
          {
            questionId: 'q10',
            question: 'Why must account containment include session revocation?',
            options: [
              'Sessions consume server memory',
              'An existing authenticated session continues to work after a password change',
              'Revocation is required by regulation',
              'It resets the account lockout counter',
            ],
            correctIndex: 1,
            explanation:
              'This is a common and costly oversight - the password is changed, everyone believes the account is contained, and the attacker never lost access.',
          },
          {
            questionId: 'q11',
            question: 'A board asks "can you guarantee this will not happen again?". What is the professionally correct answer?',
            options: [
              'Yes, with the controls we are implementing',
              'No guarantee is possible; state the controls implemented, what they address, and the residual risk that remains',
              'Decline to answer',
              'Redirect the question to the IT department',
            ],
            correctIndex: 1,
            explanation:
              'The guarantee question cannot honestly be answered yes. Answering what you can commit to is both truthful and more useful than either a false promise or evasion.',
          },
          {
            questionId: 'q12',
            question: 'A finding is raised that would embarrass your own earlier work. What does professional responsibility require?',
            options: [
              'Report it through the same process as any other finding',
              'Fix it quietly before anyone notices',
              'Report it only if someone else finds it first',
              'Reclassify it as low severity',
            ],
            correctIndex: 0,
            explanation:
              'This is the conflict where people most often fail. Honesty about findings including your own mistakes is what the trust in the role is built on.',
          },
          {
            questionId: 'q13',
            question: 'You find a connection to an external address with no preceding DNS lookup from that host. Why is that worth pursuing?',
            options: [
              'It proves the host is compromised',
              'It suggests a hard-coded address rather than a resolved name, which is unusual for legitimate software and evades DNS-based blocking',
              'It means the DNS server failed',
              'It indicates the connection was refused',
            ],
            correctIndex: 1,
            explanation:
              'It is a lead with a specific reason, not proof. Most legitimate software resolves a name first.',
          },
          {
            questionId: 'q14',
            question: 'Two engineers show the same file-access pattern as your suspect. What must your report do with that?',
            options: [
              'Omit it, since it weakens the case',
              'Include it and state how it affects your confidence',
              'Name them as additional suspects',
              'Mention it only if asked',
            ],
            correctIndex: 1,
            explanation:
              'An investigation that omits exculpatory material has not been conducted honestly, and a competent opposing examiner will find it - after which everything else you wrote is in question.',
          },
          {
            questionId: 'q15',
            question: 'A grievance raised three months before the suspected theft is in the HR record. How should it be treated?',
            options: [
              'As evidence of motive supporting the conclusion',
              'As context, not evidence - presenting it as evidence of intent would be improper',
              'As grounds to widen the investigation to personal accounts',
              'As proof the person acted deliberately',
            ],
            correctIndex: 1,
            explanation:
              'Motive is not evidence of action. Presenting it as such is exactly the kind of overreach that harms a real person and destroys the report\'s standing.',
          },
          {
            questionId: 'q16',
            question: 'Which change most improves an organisation\'s ability to investigate intrusions, at no licence cost?',
            options: [
              'Buying a second firewall',
              'Enabling process-creation logging with command lines',
              'Increasing password length requirements',
              'Adding more antivirus signatures',
            ],
            correctIndex: 1,
            explanation:
              'It is frequently off by default and is among the most useful sources in an intrusion - which is why it is described as the highest-value free logging change available.',
          },
          {
            questionId: 'q17',
            question: 'An automation script runs nightly and silently stops working. Why is this the characteristic risk of unattended automation?',
            options: [
              'Scripts always fail eventually',
              'No output looks exactly like everything being fine, so failure is invisible unless success is also reported',
              'Scheduled tasks cannot be monitored',
              'The script will consume all disk space',
            ],
            correctIndex: 1,
            explanation:
              'Design for it by reporting success as well as failure, or by alerting on the absence of an expected success.',
          },
          {
            questionId: 'q18',
            question: 'During a crisis, several executives communicate externally independently. What is the predictable consequence?',
            options: [
              'Faster communication and better outcomes',
              'Contradictions that become the story, displacing the incident itself',
              'Reduced legal exposure',
              'No effect, provided each statement is true',
            ],
            correctIndex: 1,
            explanation:
              'One voice and one record externally is why crisis structure matters more than at any other time.',
          },
          {
            questionId: 'q19',
            question: 'A vulnerability scored Critical affects a system with no network connection and no untrusted users. How should it be prioritised?',
            options: [
              'First, because severity determines priority',
              'By risk in context - low exposure may place it below a Medium finding on an internet-facing system holding sensitive data',
              'It should be ignored entirely',
              'It cannot be prioritised without a penetration test',
            ],
            correctIndex: 1,
            explanation:
              'Severity describes the flaw; risk describes your situation. Being able to explain that ordering is a large part of the professional skill.',
          },
          {
            questionId: 'q20',
            question: 'What is the single most important property of a security team, from which most others follow?',
            options: [
              'Deep technical expertise',
              'That people report bad news quickly',
              'Twenty-four-hour coverage',
              'A large tooling budget',
            ],
            correctIndex: 1,
            explanation:
              'It is built or destroyed by how the first bad news is received - and concealment, once learned, is not discovered, so the lesson appears to work.',
          },
        ],
      },
    ],
    tasks: [],
  },
];

export default YODDHA_MASTERY;
