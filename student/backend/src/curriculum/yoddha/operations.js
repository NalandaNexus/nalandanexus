/**
 * YODDHA, months 4-6: security operations, digital forensics, and the
 * offensive knowledge needed to defend - taught defensively and without targets.
 *
 * Month 6 is explicitly bounded. Vulnerability assessment is covered as
 * methodology and classification so that findings can be understood, prioritised
 * and remediated. No lesson or task here directs a student at a system they do
 * not own, and every practical exercise works from supplied material.
 */

export const OPERATIONS = [
  {
    moduleId: 'yoddha-m07',
    title: 'Month 4 · Security Monitoring',
    order: 7,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m07-l01',
        title: '7.1 Security Events',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'What counts as a security event, and the difference between event, alert and incident.',
        content:
          'The three words are used loosely and mean different things, and confusing them makes operational conversations useless.\n\n' +
          'An event is anything recorded - a login, a file access, a connection. Most events are ordinary and there are millions.\n\n' +
          'An alert is an event, or a combination, that a rule has decided deserves a human look. Alerts are produced by detection logic and their number is a design choice, not a fact about the environment.\n\n' +
          'An incident is a confirmed or strongly suspected security problem requiring response. Incidents are rare and expensive.\n\n' +
          'The ratios matter for staffing: millions of events, hundreds of alerts, a handful of incidents. Detection engineering is the work of improving the ratio between the second and the third - raising the proportion of alerts that turn out to matter.\n\n' +
          'Being precise about which word you mean prevents the common failure where "we had 400 security incidents last month" is reported to management, when the truth is 400 alerts and two incidents.',
      },
      {
        lessonId: 'yoddha-m07-l02',
        title: '7.2 Logs as Telemetry',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Choosing what to collect, and the cost of collecting everything.',
        content:
          'Collecting everything is usually proposed and rarely survives contact with cost. Storage, ingestion licensing and query performance all scale with volume, and a system too slow to query during an incident is worse than a smaller one that answers.\n\n' +
          'Prioritise by investigative value per unit of volume. Authentication events are low-volume and extremely high-value. Process creation with command lines is moderate volume and very high value. DNS queries are high volume and high value. Full packet capture is enormous volume and situational value.\n\n' +
          'Decide retention per source rather than globally. Authentication logs might be kept a year; verbose application debug logs a week. A single retention figure across everything forces the valuable sources down to what the noisy ones can afford.\n\n' +
          'Normalise at ingestion. Logs arrive in many formats, and a field meaning "source address" under five different names cannot be searched in one query. The work of mapping them to a common schema is what makes the collection usable.\n\n' +
          'And know what you are not collecting. Coverage gaps should be a documented list, not a discovery made mid-incident.',
      },
      {
        lessonId: 'yoddha-m07-l03',
        title: '7.3 Indicators of Compromise',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Atomic indicators, behavioural indicators, and why the second outlast the first.',
        content:
          'An indicator of compromise is an observable suggesting an intrusion. They differ enormously in durability.\n\n' +
          'Atomic indicators are specific values: a file hash, an IP address, a domain. They are precise, trivially checked, and easily evaded - an attacker changes a byte and the hash is new, moves to another address and the old one is worthless.\n\n' +
          'Behavioural indicators describe what was done: a document process spawning a shell, an account authenticating from two countries within an hour, bulk file encryption, a scheduled task running an interpreter from a temporary directory. These survive because the attacker must change their method to evade them, not merely their infrastructure.\n\n' +
          'This is the pyramid-of-pain idea: the higher up you detect, the more expensive evasion becomes.\n\n' +
          'Both have a place. Atomic indicators are cheap and worth applying; behavioural detection is what still works next month. An operation relying entirely on shared indicator lists is always detecting what somebody else already found.',
      },
      {
        lessonId: 'yoddha-m07-l04',
        title: '7.4 Alert Triage at Scale',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Working a queue without missing the one that matters.',
        content:
          'Triage at scale is a queue-management problem as much as a technical one.\n\n' +
          'Work by potential impact rather than by arrival order. An alert on a domain controller outranks one on a test machine regardless of which arrived first, and a queue worked strictly first-in-first-out will handle the trivial one first on the day it matters.\n\n' +
          'Establish a time budget per alert. Alerts that cannot be resolved within it are escalated rather than lingering - an analyst who spends an hour on one alert has not looked at forty others.\n\n' +
          'Enrich automatically. An alert arriving with the asset owner, the host\'s role, recent related alerts and the reputation of any external address attached is resolved far faster than one requiring five manual lookups. Automating enrichment is the highest-leverage improvement most operations can make.\n\n' +
          'Record the reasoning, briefly, on every disposition. Two sentences is enough, and it is what makes a later review possible.\n\n' +
          'Watch for alert fatigue in yourself. The failure mode is not deciding wrongly; it is ceasing to actually look while continuing to click.',
      },
      {
        lessonId: 'yoddha-m07-l05',
        title: '7.5 SIEM Concepts',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'What a SIEM does, and why buying one does not produce detection.',
        content:
          'A security information and event management system collects logs from many sources, normalises them, stores them searchably, and runs correlation rules that generate alerts.\n\n' +
          'Its value is in being one place to ask a question. During an incident, searching one system across all sources is the difference between minutes and days.\n\n' +
          'What it does not do is supply detection. A SIEM with default rules produces an alert stream tuned to nobody\'s environment, which is why so many deployments end with the alerts ignored. The detection content - rules reflecting what is normal here and what would be alarming here - is the actual work, and it is continuous.\n\n' +
          'Costs are driven by ingestion volume, which is why the collection priorities of lesson 7.2 have direct financial consequences.\n\n' +
          'The honest summary: a SIEM is a query engine and a rule engine. An organisation without the people to write rules and investigate their output has bought storage, and would be better served by collecting fewer sources well.',
      },
      {
        lessonId: 'yoddha-m07-l06',
        title: '7.6 Correlation',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Writing rules that join weak signals, and testing them before trusting them.',
        content:
          'Correlation joins events that are individually unremarkable into something that is not.\n\n' +
          'Useful correlations follow attacker sequence rather than arbitrary coincidence. Authentication failures then success then privilege change, on one account within a window. A new process on a host followed by an outbound connection to an address never seen before. A file appearing on several hosts in quick succession.\n\n' +
          'Every rule needs a window, and the window is a real design decision. Too narrow misses slow attacks - and deliberate attackers move slowly precisely because detection windows are short. Too wide and unrelated events are joined constantly.\n\n' +
          'Test a rule against historical data before enabling it. If it would have fired two hundred times last month, it is not a detection, and discovering that in production costs the team\'s trust.\n\n' +
          'Document what each rule is trying to catch and what a true positive looks like. A rule nobody can explain is a rule nobody will tune, and it will eventually be disabled during an alert storm by someone who does not know what it was for.',
      },
      {
        lessonId: 'yoddha-m07-l07',
        title: '7.7 Detection Engineering Fundamentals',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Treating detection as something built, tested and maintained.',
        content:
          'Detection engineering treats detections as engineered artefacts with a lifecycle, rather than rules someone once wrote.\n\n' +
          'It starts from a threat: a specific technique you want to catch. Then the data required - and frequently this step reveals you are not collecting what would be needed, which is itself the finding.\n\n' +
          'Then the logic, then validation against both historical data for false positives and a safe, authorised reproduction of the technique for true positives. A detection never tested against the thing it is meant to catch is a hypothesis.\n\n' +
          'Then maintenance. Environments change, software updates alter log formats, and a detection silently stops matching. Detections need periodic revalidation, and a detection that has not fired in a year is either excellent or broken - and you cannot tell which without testing.\n\n' +
          'Version-control detections with their rationale, expected true positive, known false positives and test results. This is the discipline that separates an operation that improves over time from one that accumulates rules.',
      },
    ],
    quizzes: [],
    tasks: [],
  },

  {
    moduleId: 'yoddha-m08',
    title: 'Month 4 · Incident Detection',
    order: 8,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m08-l01',
        title: '8.1 Incident Identification',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Deciding that an alert has become an incident.',
        content:
          'The transition from alert to incident is a decision, and it should be a deliberate one with criteria, because declaring an incident mobilises people and costs money.\n\n' +
          'Reasonable criteria: confirmed unauthorised access; confirmed malicious code execution; confirmed data exposure; or a strong suspicion of any of these affecting something significant. Note that suspicion is sufficient when impact is high - waiting for confirmation is how response begins late.\n\n' +
          'Incidents also arrive from outside detection entirely: a user reporting something odd, a supplier notification, an external researcher, or law enforcement. Organisations frequently learn of their most serious incidents this way, which is worth remembering when judging monitoring coverage.\n\n' +
          'Declare early and downgrade if wrong. The cost of an unnecessary declaration is some wasted time; the cost of a late one is measured in how far the intrusion progressed while nobody was responding.\n\n' +
          'Record the moment of declaration and the basis for it. Reviews always ask when you knew, and reconstructing that afterwards is unreliable.',
      },
      {
        lessonId: 'yoddha-m08-l02',
        title: '8.2 Initial Triage',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'The first thirty minutes, and the questions that shape everything after.',
        content:
          'Early triage sets the direction of the whole response, and errors here are expensive to unwind.\n\n' +
          'Four questions come first. What is confirmed, as distinct from suspected? What is the scope - how many systems and accounts, as far as you currently know? Is it ongoing or historical? And what is at risk if it continues?\n\n' +
          'Resist two opposite errors. Acting before understanding - rebuilding a machine immediately destroys the evidence needed to find the other six. And understanding before acting when harm is ongoing - a full investigation while data is actively leaving is the wrong sequence.\n\n' +
          'Preserve before you change. Even under pressure, capturing memory and taking an image before remediation is usually a few minutes, and it is the difference between knowing what happened and guessing.\n\n' +
          'Assume scope is larger than it appears. Initial scope estimates are almost always low, because you find first what you were looking at. Treat the first affected host as a sample rather than the population.',
      },
      {
        lessonId: 'yoddha-m08-l03',
        title: '8.3 Severity Classification',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Assigning severity consistently, and reclassifying as evidence changes.',
        content:
          'Severity drives resourcing, escalation and communication, so it must be assigned against criteria rather than by feel.\n\n' +
          'Base it on impact: what is affected, how sensitive, how many people, whether operations stop, and whether there are regulatory consequences. Modify by scope and by whether it is ongoing.\n\n' +
          'Three or four levels are enough. More produces arguments about whether something is a three or a four, which consumes exactly the time the classification was meant to save.\n\n' +
          'Reclassification is normal and should be explicitly permitted. Incidents routinely start small and grow as scope becomes clear. What matters is that each change is recorded with its time and reason, because the review will reconstruct the response against what was known when.\n\n' +
          'Avoid severity inflation. If every incident is critical, the classification conveys nothing and the team is permanently at maximum alert - which is the condition in which real critical incidents are handled worst.',
      },
      {
        lessonId: 'yoddha-m08-l04',
        title: '8.4 Containment Concepts',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Stopping the harm without destroying the evidence or tipping off the intruder.',
        content:
          'Containment limits damage while the rest of the response proceeds. It involves genuine trade-offs that should be decided deliberately.\n\n' +
          'Speed against evidence: isolating a machine immediately stops harm and may lose volatile evidence. Capturing memory first costs minutes. Which is right depends on whether harm is ongoing and how significant the evidence is.\n\n' +
          'Visibility against completeness: an attacker who notices containment may accelerate, destroy evidence, or activate access elsewhere. Containing one host while leaving others compromised may achieve nothing except warning them.\n\n' +
          'Network isolation is usually the best first move: it stops command and control and data movement while preserving the machine\'s state, and it is reversible - which, by the decision framework from GARUD, is exactly what makes it suitable for acting on suspicion.\n\n' +
          'Account containment - disabling accounts, forcing password resets, revoking sessions - must include session revocation. Changing a password while an active session continues achieves nothing, and this is a common and costly oversight.\n\n' +
          'Plan to contain everything at once where you can. Sequential containment gives an attacker time to move.',
      },
      {
        lessonId: 'yoddha-m08-l05',
        title: '8.5 Evidence Preservation Under Pressure',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Applying forensic discipline when there is no time for it.',
        content:
          'The forensic principles from GARUD do not change during an incident; what changes is that following them feels unaffordable.\n\n' +
          'Prioritise. You cannot image everything, so image the systems most likely to explain what happened and those most likely to be disputed later. Capture volatile data broadly, since it is quick and disappears permanently.\n\n' +
          'Record as you go, even roughly. A rough contemporaneous note beats a polished reconstruction, and during an incident nobody will remember the order of the first two hours.\n\n' +
          'Protect the evidence from the response. Remediation destroys evidence as a matter of course - rebuilding machines, resetting accounts, clearing mailboxes. Someone must own preservation explicitly, or it will be nobody\'s job while everybody is busy.\n\n' +
          'Watch retention clocks. Logs continue rolling over during the incident, and a source with seven days of retention may lose the relevant period while you are working. Export the relevant windows early, before you need them.',
      },
      {
        lessonId: 'yoddha-m08-l06',
        title: '8.6 Incident Documentation',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'The running record that makes response coordinated and reviewable.',
        content:
          'An incident log is a single running record of what was observed, decided and done, with times. It serves three purposes: coordination now, review later, and evidence if it is ever needed.\n\n' +
          'Record observations, actions and decisions separately. "14:20 observed outbound connection to X" and "14:25 decided to isolate host Y because Z" are different entries, and the second must include the reasoning.\n\n' +
          'Record actions taken, including failed and reversed ones. A reader who sees only successful actions cannot understand why something took four hours.\n\n' +
          'One log, one place, everyone writing to it. Parallel notes in individual chat threads produce an unreconstructable response.\n\n' +
          'Assign someone to maintain it who is not simultaneously doing the hands-on work. During a serious incident the responders cannot also write, and the record written afterwards from memory is exactly the one that will be found inadequate.\n\n' +
          'Note times in a single timezone, stated. This problem recurs because it keeps causing damage.',
      },
      {
        lessonId: 'yoddha-m08-l07',
        title: '8.7 Incident Reporting',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Reporting internally and externally, at the right time and detail.',
        content:
          'Different audiences need different reports, and producing one document for all of them serves none.\n\n' +
          'Executive: what happened, what the impact is, what is being done, what is needed, and by when. Short, in business terms, with no technique detail.\n\n' +
          'Technical: the full timeline, evidence, indicators, and remediation actions, complete enough that another practitioner could verify it.\n\n' +
          'External: customers, partners, regulators and sometimes the public. These carry legal weight and must involve legal input. Be factual, say what is confirmed, say what people should do, and never speculate about scope.\n\n' +
          'Timing is a real decision. Reporting too early risks retracting, which damages credibility; too late risks appearing to conceal and may breach notification deadlines, which in several jurisdictions are short and count from awareness rather than confirmation.\n\n' +
          'Raise the obligation question early. Whether a notification duty has been triggered is a legal determination, and the security practitioner\'s job is to ensure it is asked at the right moment, not to answer it.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'yoddha-m08-a01',
        title: 'Incident Triage Report',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 90,
        dueOffsetDays: 18,
        iconName: 'Siren',
        description:
          'Work a live incident from the supplied telemetry. Everything is provided; nothing is to be tested anywhere.\n\n' +
          'TIME IS 09:12. You are the first responder. All times UTC.\n\n' +
          'ALERTS RECEIVED:\n' +
          '  08:47 Process creation: powershell.exe, parent outlook.exe, host FIN-LT-11, user a.desai, encoded command line\n' +
          '  08:51 Auth: OK a.desai on FIN-SRV-02 from FIN-LT-11 (first time this account has reached this server)\n' +
          '  08:58 Auth: 14 x FAIL across 14 distinct accounts from FIN-LT-11, then 1 OK for svc.backup\n' +
          '  09:03 Flow: FIN-SRV-02 -> 198.51.100.77:443, ongoing, 220 MB transferred so far, rising\n' +
          '  09:09 Process creation: vssadmin.exe on FIN-SRV-02, user svc.backup\n\n' +
          'CONTEXT: FIN-SRV-02 holds the finance file share. svc.backup is a service account with administrative rights on all file servers. Endpoint logs retained 30 days; flow records 90 days; no memory capture tooling deployed. It is a Tuesday morning and the finance team is working.\n\n' +
          'PRODUCE:\n' +
          '1. Confirmed versus suspected, as two explicit lists.\n' +
          '2. Your severity classification against stated criteria, and why.\n' +
          '3. The attack sequence you believe occurred, with which alert supports each step - and mark any step that is inference rather than evidence.\n' +
          '4. Identify what the 08:58 pattern is, and why per-account lockout thresholds did not fire.\n' +
          '5. Say what vssadmin at 09:09 most likely indicates and why it raises urgency sharply.\n' +
          '6. Your containment plan for the next fifteen minutes, in order, with the trade-off you are accepting at each step. Address explicitly: whether to isolate FIN-LT-11, FIN-SRV-02 or both; what you do about svc.backup and why a password reset alone is insufficient; and whether sequential containment risks warning the intruder.\n' +
          '7. What you preserve before remediating, given no memory tooling exists.\n' +
          '8. Three questions you need answered and who you would ask.\n\n' +
          'Assessed on: whether confirmed and suspected are genuinely separated, whether you recognise the spraying pattern and the shadow-copy deletion, whether your containment ordering reflects real trade-offs rather than a checklist, and whether the session-revocation point is made.',
      },
    ],
  },

  {
    moduleId: 'yoddha-m09',
    title: 'Month 5 · Forensic Foundations',
    order: 9,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m09-l01',
        title: '9.1 Digital Evidence',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'What makes digital evidence admissible, reliable and fragile.',
        content:
          'Digital evidence is data used to establish what happened. Its distinctive properties shape everything about handling it.\n\n' +
          'It is trivially copyable, so a perfect copy is as good as the original - which is why analysis always happens on a copy. It is trivially alterable, often without trace, which is why integrity must be demonstrated rather than assumed. And it is frequently volatile, which is why order of collection matters.\n\n' +
          'Reliability rests on three things: that it was collected properly, that it has not changed since, and that its interpretation is sound. All three can be challenged, and the third most often - two people can agree on what a log says and disagree about what it means.\n\n' +
          'Evidence is rarely self-explanatory. A timestamp requires knowing the timezone and whether the clock was correct. A log entry requires knowing what that software logs and when. Presenting evidence without that context invites incorrect conclusions, including your own.',
      },
      {
        lessonId: 'yoddha-m09-l02',
        title: '9.2 Forensic Methodology',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'A repeatable process, and why repeatability is the point.',
        content:
          'Forensic methodology exists so that two competent examiners with the same evidence reach the same conclusion. Without that, findings are one person\'s opinion.\n\n' +
          'The stages are identification, preservation, analysis and presentation, and each has its own standard of care. The sequence is not negotiable: analysing before preserving destroys the ability to demonstrate that what you analysed is what existed.\n\n' +
          'Repeatability requires documentation sufficient for someone else to follow your steps, including the tools used and their versions - because a different version may behave differently, and a finding that cannot be reproduced is a finding that will not survive challenge.\n\n' +
          'Work from a hypothesis but test it against evidence that would disconfirm it. The characteristic forensic failure is building a case for what you already believe, and it is more likely when the answer seems obvious early.\n\n' +
          'Know the limits of your tools. A tool that parses an artefact may do so incompletely or incorrectly, and treating tool output as ground truth without understanding what it did is how confident errors are made.',
      },
      {
        lessonId: 'yoddha-m09-l03',
        title: '9.3 Acquisition Concepts',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Imaging, live versus dead acquisition, and what each choice costs.',
        content:
          'Acquisition is capturing evidence in a verifiable form.\n\n' +
          'Dead acquisition images a powered-off system. It produces the cleanest result because nothing changes during capture, and it loses everything volatile - memory, running processes, live connections, and anything decrypted only while running.\n\n' +
          'Live acquisition captures from a running system. It obtains volatile evidence and necessarily changes the system while doing so, because your tools consume memory and may write to disk.\n\n' +
          'There is no universally correct choice, which is why the reasoning is recorded. A machine with encrypted storage that is currently unlocked is a strong case for live acquisition - power it off and the data may be unreachable.\n\n' +
          'Modern environments complicate this. Cloud systems may not offer disk access at all, and evidence exists as provider logs and snapshots instead. Mobile devices are frequently encrypted and restrict access by design.\n\n' +
          'Always verify after acquisition: hash the source and the image, and record both. An image that cannot be verified is an unverified copy.',
      },
      {
        lessonId: 'yoddha-m09-l04',
        title: '9.4 Hashing in Forensics',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Applying hashes to evidence, identification and deduplication.',
        content:
          'Hashing serves three distinct forensic purposes, and they are worth separating.\n\n' +
          'Integrity: hash at acquisition and at every subsequent point. A matching hash demonstrates the evidence has not changed while in your possession, which is what chain of custody claims and hashing proves.\n\n' +
          'Identification: known files can be recognised by hash without examining content. Sets of known-good system files can be excluded from examination, dramatically reducing what must be reviewed; sets of known-bad files can be flagged.\n\n' +
          'Deduplication: identical files across many systems are hashed once and examined once.\n\n' +
          'Limitations matter. A hash identifies exact content, so any alteration produces a completely different value - which is what makes it useless for finding similar-but-modified files. Fuzzy hashing exists for that and is a different technique with different guarantees.\n\n' +
          'Use SHA-256. MD5 and SHA-1 have practical collisions, so a match no longer proves identical content, and an examiner relying on them can be challenged on exactly that point.',
      },
      {
        lessonId: 'yoddha-m09-l05',
        title: '9.5 Chain of Custody in Practice',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Maintaining custody through a real incident with many people involved.',
        content:
          'Chain of custody is straightforward in principle and fails in practice through ordinary organisational friction.\n\n' +
          'Every transfer is recorded: item, time, from whom, to whom, why, and condition including hash. Storage between transfers must be controlled, and who had access to that storage is part of the record.\n\n' +
          'The common failures are mundane. An image copied to a shared drive "so the team can look" - now anyone with drive access is in the chain and nobody recorded it. An analyst taking a copy home to work on. A laptop held in an unlocked drawer over a weekend. None involve wrongdoing, and all create gaps.\n\n' +
          'Minimise handling. Fewer copies and fewer people means fewer transfers to record and fewer opportunities for a gap.\n\n' +
          'During a large incident, designate one evidence custodian. Distributed responsibility for custody reliably produces no custody record at all, discovered weeks later when it matters.',
      },
      {
        lessonId: 'yoddha-m09-l06',
        title: '9.6 Evidence Integrity',
        duration: '20 mins',
        subject: 'CYBERSECURITY',
        summary: 'Demonstrating that evidence is what it claims to be.',
        content:
          'Integrity means the evidence now is the evidence collected. Demonstrating it, rather than asserting it, is the standard.\n\n' +
          'Technical measures: hash at acquisition, verify at each use, use write blockers, store on media that is not routinely written to, and keep an original copy that is never worked on.\n\n' +
          'Procedural measures: restricted access, the custody record, and a working copy separate from the archive copy. Analysis happens on the working copy, which can be discarded and regenerated if damaged.\n\n' +
          'Integrity can be undermined without anyone acting improperly. Opening a file may update its access time. Mounting an image read-write modifies it. Antivirus software may quarantine an evidence file. Each is a routine action that damages integrity, which is why evidence is handled on systems configured for the purpose.\n\n' +
          'If integrity is compromised, say so and say how. An examiner who discloses a problem retains credibility; one whose undisclosed problem is discovered by the other side does not.',
      },
      {
        lessonId: 'yoddha-m09-l07',
        title: '9.7 Forensic Documentation',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Recording examination so the conclusion can be verified independently.',
        content:
          'Forensic documentation must let another examiner verify your conclusion from your notes and the evidence.\n\n' +
          'Record for each step: what you did, when, with which tool and version, against which evidence item, and what you observed. Include steps that found nothing - a negative result is a result, and it shows the conclusion survived alternatives.\n\n' +
          'Keep observation and interpretation visibly separate. This is now the third time this appears in the curriculum, because it is the single most common defect in real reports.\n\n' +
          'Record the questions you could not answer and why. An examination reporting only findings implies a completeness it does not have.\n\n' +
          'Preserve the working notes, not only the final report. The report is a conclusion; the notes are how you reached it, and a challenge will be directed at the path more often than the destination.\n\n' +
          'Write for a reader who is skilled but sceptical, and who does not have you available to ask.',
      },
    ],
    quizzes: [],
    tasks: [],
  },

  {
    moduleId: 'yoddha-m10',
    title: 'Month 5 · File System & Artifact Analysis',
    order: 10,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m10-l01',
        title: '10.1 File Systems in Depth',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Allocation, slack space and journals - where evidence hides.',
        content:
          'A file system allocates storage in fixed-size units. A file smaller than a unit leaves the remainder unused, and that remainder - slack space - may still contain fragments of whatever was there before.\n\n' +
          'Deletion typically removes the directory entry and marks units available. The content persists until reused, which is why recovery is frequently possible and why "deleted" is not a security control.\n\n' +
          'Journaling file systems record intended changes before making them, so they can recover from interruption. The journal is an investigative asset: it may contain records of operations whose effects have since been overwritten, including file creations and deletions no longer visible anywhere else.\n\n' +
          'Fragmentation means a file may be scattered across non-contiguous units, which matters when reconstructing a partially overwritten file.\n\n' +
          'The practical consequence is that examining visible files examines a fraction of what is there. Unallocated space, slack space and the journal are where the evidence someone tried to remove tends to survive.',
      },
      {
        lessonId: 'yoddha-m10-l02',
        title: '10.2 Metadata Analysis',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Reading timestamps rigorously, including the ones that resist tampering.',
        content:
          'File timestamps are among the most-used and most-misused evidence.\n\n' +
          'Systems typically track modification, access and creation times, and additionally a metadata-change time. That last one is significant because it is updated when file metadata changes and is not settable by the ordinary interfaces that let a user alter the other three - so a file whose creation time is older than its metadata-change time, with no legitimate explanation, indicates tampering.\n\n' +
          'This is why timestamps are analysed as a set rather than individually. Internal inconsistency is the signal; any single timestamp on its own can be anything.\n\n' +
          'Ordinary operations change timestamps without any wrongdoing. Copying, archiving and restoring from backup all produce patterns that look unusual to someone who does not know what happened to the file.\n\n' +
          'Corroborate against independent sources. A file system timestamp supported by a log entry and an application artefact is far stronger than any of the three alone - and building that corroboration is most of the work.',
      },
      {
        lessonId: 'yoddha-m10-l03',
        title: '10.3 Deleted File Concepts',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'What survives deletion, what does not, and what that proves.',
        content:
          'Recovering deleted files exploits the gap between removing a reference and overwriting content.\n\n' +
          'Where the metadata entry survives, recovery is straightforward and the original name and timestamps are known. Where it does not, carving searches raw storage for recognisable file structures - which recovers content but loses the name, location and timestamps, so a carved file has weaker evidential value.\n\n' +
          'Several things reduce recoverability: continued use of the system overwrites space, modern storage may erase unused blocks in the background, and deliberate secure deletion overwrites content directly.\n\n' +
          'Be careful about what deletion proves. A deleted file is not evidence of concealment - people delete things constantly for ordinary reasons. Deletion of specific files immediately after a notice to preserve evidence is a different matter, and that is an argument about timing and context, not about deletion itself.\n\n' +
          'Note also that mass deletion leaves its own traces: the journal, the recycle bin, and application artefacts referencing files that no longer exist.',
      },
      {
        lessonId: 'yoddha-m10-l04',
        title: '10.4 Browser Artifacts',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'What a browser records, and how much survives private browsing.',
        content:
          'Browsers are among the richest artefact sources because they record activity in several places at once.\n\n' +
          'History records visited addresses with times and visit counts. Cache holds copies of retrieved content, which can show what a page contained at the time even if it has since changed. Cookies and site storage show which sites held a session. Downloads record what was retrieved, from where, and where it was saved. Autofill data and saved credentials reveal prior form entries.\n\n' +
          'Private browsing reduces what is written to disk but does not eliminate traces: DNS lookups still occurred, network logs still recorded connections, and fragments frequently survive in memory or in the page file.\n\n' +
          'For an investigation the download record is often the most directly useful - establishing that a file arrived, from where, and when. The cache is most useful for establishing what a user was actually shown, which matters in phishing cases where the site is later taken down.\n\n' +
          'Corroborate against network and proxy logs wherever they exist; local artefacts can be cleared, and server-side records usually cannot be by the same person.',
      },
      {
        lessonId: 'yoddha-m10-l05',
        title: '10.5 User Activity Artifacts',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Traces of what a person did, and the limits on attributing them to a person.',
        content:
          'Operating systems record a great deal about user activity, often for convenience features rather than for auditing.\n\n' +
          'Recently opened documents, shortcut files pointing at previously accessed paths, jump lists, thumbnail caches, search history, and evidence of program execution all persist. Program execution artefacts are particularly valuable because they may show that a program ran and when, even after the program itself was deleted.\n\n' +
          'Removable media leaves records: devices connected, when, and frequently which files were accessed from them. This is central to data-exfiltration investigations.\n\n' +
          'The critical limit is attribution. These artefacts record activity under a user account, not activity by a person. A shared account, an unlocked workstation, or a compromised session all produce artefacts indistinguishable from the legitimate user\'s.\n\n' +
          'Strengthening attribution requires independent corroboration: physical access records, camera footage, activity patterns consistent with a person\'s known whereabouts. Stating account activity as personal action without that corroboration is the most serious error an examiner can make, because it is the one that harms a specific person.',
      },
      {
        lessonId: 'yoddha-m10-l06',
        title: '10.6 System Artifacts',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Configuration, persistence and event records that reveal system change.',
        content:
          'System artefacts describe the machine rather than the user, and they are where intrusions are most often confirmed.\n\n' +
          'Configuration stores record installed software, services, scheduled tasks, and startup entries - with the timestamps of when each was created or modified. An entry created during the incident window is a strong indicator.\n\n' +
          'Event logs record authentication, service changes, privilege use and, where enabled, process creation. Their value depends entirely on what was enabled beforehand, which is why the logging configuration lesson in month 2 matters here.\n\n' +
          'Crash and error reports sometimes contain memory fragments from the moment of failure, which occasionally preserves evidence of what was running.\n\n' +
          'Prefetch and similar execution artefacts record that a program ran, how many times and when - frequently surviving after the executable is removed.\n\n' +
          'Build a timeline from system artefacts first, then overlay user artefacts. System changes tend to have clearer causation, and they anchor the sequence that user activity is then interpreted against.',
      },
      {
        lessonId: 'yoddha-m10-l07',
        title: '10.7 Timeline Analysis at Depth',
        duration: '26 mins',
        subject: 'CYBERSECURITY',
        summary: 'Super-timelines, correlation across artefact types, and handling contradiction.',
        content:
          'A super-timeline combines every timestamped artefact - file system, logs, browser, execution, registry - into one ordered sequence. It is the most powerful forensic technique and produces overwhelming volume, so it is used with filters.\n\n' +
          'The value is that different artefact types corroborate each other. A download record, then a file creation, then an execution artefact, then an outbound connection - four independent sources describing one sequence - is far stronger than any one of them.\n\n' +
          'Contradictions are informative. Where two sources disagree, one of three things is true: a clock is wrong, you have misunderstood what one source records, or something was manipulated. Work through them in that order, because the first two are far more common than the third and an examiner who reaches for tampering first will be wrong most of the time.\n\n' +
          'Gaps deserve the same attention as entries. A period with no artefacts on a machine that was in use is a question.\n\n' +
          'Build the timeline before forming the narrative. A timeline assembled to support a conclusion will support it, and will be wrong.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'yoddha-m10-a01',
        title: 'Forensic Artifact Analysis',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 90,
        dueOffsetDays: 21,
        iconName: 'Fingerprint',
        description:
          'Analyse a supplied artefact set and produce a defensible reconstruction. All material is provided; examine nothing you do not own.\n\n' +
          'ARTEFACT SET (host WS-ENG-07, user k.nair, all times UTC unless marked):\n' +
          'Browser downloads: 2026-04-02 13:41 "invoice-Q1.zip" from hxxps://shared-docs-review[.]net/d/8821, saved to C:\\Users\\k.nair\\Downloads\\\n' +
          'File system: C:\\Users\\k.nair\\Downloads\\invoice-Q1.zip  created 13:41, modified 13:41, metadata-changed 13:41\n' +
          '             C:\\Users\\k.nair\\AppData\\Local\\Temp\\upd.exe  created 13:44, modified 2026-01-08, metadata-changed 13:44\n' +
          'Execution artefact: upd.exe first executed 13:45, run count 3, last run 2026-04-02 18:10\n' +
          'Scheduled task: "SystemUpdateCheck" created 13:46, runs upd.exe every 30 minutes, created by k.nair\n' +
          'Event log: no process-creation logging enabled on this host\n' +
          'Flow records: WS-ENG-07 -> 203.0.113.90:443 at 13:47 and every 30 minutes thereafter, ~800 bytes each\n' +
          'DNS: no lookup recorded for 203.0.113.90 from this host\n' +
          'Proxy logs: retained 14 days; this analysis is being done on 2026-04-30\n\n' +
          'PRODUCE:\n' +
          '1. A super-timeline of every artefact, one timezone, each entry naming its source type.\n' +
          '2. The reconstruction: what happened, step by step, marking each step as evidenced or inferred.\n' +
          '3. Explain the timestamp anomaly on upd.exe. Its modified time precedes its creation time by three months - give the innocent explanation and the suspicious one, and say which the other evidence supports.\n' +
          '4. Explain what the absence of a DNS lookup for 203.0.113.90 suggests.\n' +
          '5. Explain what the 30-minute flow pattern is and which artefact confirms its mechanism.\n' +
          '6. State what you cannot determine and why - address specifically the missing process-creation logging and the 14-day proxy retention against a 28-day-old incident.\n' +
          '7. Attribution: state precisely what the evidence supports about who did this, and what it does not.\n\n' +
          'Assessed on: whether the timeline is built before the narrative, whether the timestamp anomaly is reasoned rather than assumed to be tampering, whether you identify beaconing and its scheduled-task mechanism, and whether item 7 is appropriately careful.',
      },
    ],
  },

  {
    moduleId: 'yoddha-m11',
    title: 'Month 6 · Vulnerability Assessment',
    order: 11,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m11-l01',
        title: '11.1 Vulnerability Concepts',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Vulnerability, threat and risk as three distinct things.',
        content:
          'These three words are used interchangeably and should not be. A vulnerability is a weakness. A threat is something that could exploit it. Risk is the combination, weighted by likelihood and impact.\n\n' +
          'The distinction has practical consequences. A vulnerability with no plausible threat is low risk - an exploitable flaw in a system with no network connection and no untrusted users. A minor weakness facing an active, capable threat may be high risk.\n\n' +
          'Vulnerabilities arise in design, implementation and configuration. Design flaws are the most expensive to fix because the weakness is in the intended behaviour. Implementation flaws are bugs. Configuration flaws are the most common in practice and the cheapest to fix.\n\n' +
          'Vulnerabilities are found by testing, by analysis, by research and by disclosure. They are also found by attackers, who do not report them - which is why the absence of known vulnerabilities is not evidence of their absence.\n\n' +
          'This module is about assessing and remediating them. It is deliberately not about exploiting anything you do not own.',
      },
      {
        lessonId: 'yoddha-m11-l02',
        title: '11.2 Risk in Context',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Why the same vulnerability is a different risk in two organisations.',
        content:
          'A vulnerability score describes the flaw, not your situation. Context turns it into risk.\n\n' +
          'Exposure: is the affected system reachable from the internet, from the internal network only, or from a segmented zone few can enter? This routinely changes the practical risk by an order of magnitude.\n\n' +
          'Value: what does the system hold or control? The same flaw on a test server and on the payroll system are different problems.\n\n' +
          'Compensating controls: is there monitoring that would detect exploitation, network control that would limit it, or an architecture that contains it?\n\n' +
          'Exploit availability: a flaw with public working exploit code and active use in the wild is a materially different proposition from a theoretical one.\n\n' +
          'This is why an organisation cannot simply patch in severity order. A defensible remediation plan is severity, modified by exposure, value and compensating controls - and being able to explain that ordering is a large part of the professional skill.',
      },
      {
        lessonId: 'yoddha-m11-l03',
        title: '11.3 Attack Surface',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Everything reachable by someone who should not have it, and how it grows.',
        content:
          'Attack surface is the set of points where an untrusted party can interact with a system. Reducing it is among the most reliable security activities, because what is not present cannot be attacked.\n\n' +
          'It includes network services, application inputs, authentication endpoints, file upload handling, APIs, integrations with third parties, and the people who can be contacted.\n\n' +
          'It grows continuously and quietly. Every new feature, integration, service and cloud account adds to it, and things are added far more often than removed. Systems left running after a project ends are a recurring source of incidents precisely because nobody is maintaining or watching them.\n\n' +
          'Measuring it starts with inventory, which is why asset inventory keeps recurring as a security control. You cannot assess what you do not know exists, and the systems nobody knows about are the least patched.\n\n' +
          'Reduction is unglamorous: decommission what is unused, close what need not be open, remove integrations no longer needed, and restrict what must remain to the smallest audience that requires it.',
      },
      {
        lessonId: 'yoddha-m11-l04',
        title: '11.4 Security Testing Methodology',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'How assessments are structured, scoped and authorised.',
        content:
          'Security testing is structured work performed under explicit authorisation. The authorisation is not a formality - the same actions without it are criminal in most jurisdictions.\n\n' +
          'Scope defines what may be tested, from where, when, and by what methods. It must be written and agreed before anything begins, and it must name systems precisely, because a shared hosting environment may place someone else\'s systems at the same address.\n\n' +
          'Testing types differ in knowledge and access. Vulnerability assessment identifies and reports weaknesses. Penetration testing attempts to demonstrate exploitability. A red team exercise tests detection and response rather than enumerating flaws.\n\n' +
          'A rules-of-engagement document covers what is out of bounds, how to handle discovering something critical mid-test, who to contact, and what happens if something breaks.\n\n' +
          'This course does not ask you to perform any of this against a live system. The reason it is taught is that you will commission, read and act on such reports - and a report you cannot evaluate is a report you will either over- or under-react to.',
      },
      {
        lessonId: 'yoddha-m11-l05',
        title: '11.5 Vulnerability Classification',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Common weakness classes, and why classification aids remediation.',
        content:
          'Classifying a vulnerability by its underlying weakness is more useful than treating each as unique, because the class determines the fix.\n\n' +
          'Recurring classes: improper input validation, which produces injection flaws of several kinds; broken authentication; broken access control, where authentication succeeds and authorisation is not checked; sensitive data exposure through inadequate protection in transit or at rest; security misconfiguration; and use of components with known vulnerabilities.\n\n' +
          'Classification helps in three ways. It points at the fix - injection flaws are fixed by separating data from commands, wherever they appear. It reveals patterns: five findings of the same class across an application indicate a development practice problem rather than five unrelated bugs. And it supports prioritisation, since some classes are systematically more serious.\n\n' +
          'When reading an assessment report, group findings by class before reading them individually. The grouping usually tells you more about what to change than the individual findings do.',
      },
      {
        lessonId: 'yoddha-m11-l06',
        title: '11.6 Remediation',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Turning findings into completed fixes, and verifying them.',
        content:
          'A vulnerability report produces value only when findings are remediated. The gap between report and fix is where most of the failure happens.\n\n' +
          'Triage first: verify the finding is real - assessment tools produce false positives - assess it in context, and decide the response. Fix, mitigate with a compensating control, or accept with a recorded rationale and a review date.\n\n' +
          'Assign an owner and a date to every finding you intend to fix. Findings without an owner are not fixed; findings with a team rather than a person as owner are usually not fixed either.\n\n' +
          'Fix the class, not only the instance. If a report finds one injection flaw, the same pattern almost certainly exists elsewhere, and fixing only the reported instance leaves the rest.\n\n' +
          'Verify. A finding marked fixed without retesting is a finding marked fixed. Retest specifically, and record the verification.\n\n' +
          'Track the ageing of open findings. A vulnerability open for six months is a decision that was never actually made, and the tracking is what surfaces it.',
      },
    ],
    quizzes: [],
    tasks: [],
  },

  {
    moduleId: 'yoddha-m12',
    title: 'Month 6 · Defensive Security',
    order: 12,
    subject: 'CYBERSECURITY',
    lessons: [
      {
        lessonId: 'yoddha-m12-l01',
        title: '12.1 Hardening',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Systematic reduction of capability, applied at scale.',
        content:
          'Hardening at scale means a defined standard applied automatically, not a checklist performed by hand on each machine.\n\n' +
          'Start from a published baseline appropriate to the system, then adapt it to what the organisation actually needs. Adopting a benchmark without adaptation breaks things and produces exceptions that dissolve the standard.\n\n' +
          'Apply through automation. Manual hardening produces machines that were hardened at some point and have drifted since, with nobody able to say which are compliant.\n\n' +
          'Measure compliance continuously and treat drift as an event to investigate. A machine that has fallen out of compliance changed for a reason, and the reason is sometimes an intrusion.\n\n' +
          'Prioritise by leverage. Removing administrative rights from ordinary users, disabling legacy protocols, and eliminating default credentials deliver more than a long tail of minor settings - and an organisation that does those three consistently is ahead of one with a perfect benchmark score on half its estate.',
      },
      {
        lessonId: 'yoddha-m12-l02',
        title: '12.2 Access Controls in Practice',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Implementing least privilege in an organisation that resists it.',
        content:
          'Least privilege is universally agreed and rarely implemented, because every individual exception is reasonable and the accumulation is not.\n\n' +
          'Start from roles derived from what people actually do, established by observing access rather than by asking managers what their teams need - the two answers differ considerably.\n\n' +
          'Handle exceptions with expiry. Temporary elevated access that expires automatically is the single most effective mechanism, because the failure mode of manual revocation is that it does not happen.\n\n' +
          'Privileged access deserves separate treatment: separate accounts, multi-factor authentication, session recording where justified, and time-bounded elevation rather than standing rights.\n\n' +
          'Review periodically, and make the review meaningful. A review where a manager approves a list of two hundred entries in one click is theatre. Reviewing by exception - showing what changed and what is unused - produces real decisions.\n\n' +
          'Measure unused access. An account with rights never exercised in six months is a candidate for removal, and this metric finds more genuine over-provisioning than any interview.',
      },
      {
        lessonId: 'yoddha-m12-l03',
        title: '12.3 Secure Configuration Management',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Keeping configuration correct over time rather than at a moment.',
        content:
          'Configuration is not a state you reach; it is a state you maintain against constant pressure to change it.\n\n' +
          'Define intended configuration explicitly and store it as code, reviewed like any other change. This makes the intended state inspectable and gives every change an author and a reason.\n\n' +
          'Detect drift continuously by comparing actual to intended. Report differences as findings, and investigate rather than merely correcting - a change nobody can account for is a security question.\n\n' +
          'Make the correct path the easy path. If the standard build is quick to deploy and a bespoke one is slow, people use the standard. If the reverse, no policy will prevent drift.\n\n' +
          'Manage change through a process that records what changed and how to reverse it. During an investigation, "what changed on this system recently?" is among the most valuable questions, and it is unanswerable in organisations without change records.\n\n' +
          'Include cloud configuration. Cloud misconfiguration - storage exposed publicly, over-permissive identity policies - accounts for a substantial share of modern data exposure.',
      },
      {
        lessonId: 'yoddha-m12-l04',
        title: '12.4 Monitoring as a Control',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Designing monitoring to answer specific questions rather than to collect.',
        content:
          'Monitoring designed as "collect everything and look for anomalies" produces volume and little detection. Monitoring designed to answer specific questions produces answers.\n\n' +
          'Work backwards from the threats you care about. For each, ask what it would look like in telemetry, whether you collect that telemetry, and whether anything examines it. That chain - threat, observable, collection, detection, response - is the design, and it commonly breaks at the third or fourth link.\n\n' +
          'Prioritise detection where an attacker must pass. Detections on the paths to valuable systems are worth more than broad coverage of unimportant ones.\n\n' +
          'Monitor the controls themselves. An endpoint agent that stopped reporting, a log source that went quiet, a rule that was disabled - each is a control failure that is invisible unless specifically watched, and each is also something an intruder might cause deliberately.\n\n' +
          'Test detection deliberately with authorised, benign actions that should alert. This is the only way to distinguish "nothing is happening" from "we would not see it".',
      },
      {
        lessonId: 'yoddha-m12-l05',
        title: '12.5 Detection Coverage',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Mapping what you can detect against what attackers actually do.',
        content:
          'Coverage mapping compares your detections against a structured catalogue of known attacker techniques, producing an honest picture of where you are blind.\n\n' +
          'The value is that it replaces impression with a map. Most organisations discover they have deep coverage of initial access and very little of lateral movement and persistence - which is precisely backwards, since those later stages offer the longest window to catch an intrusion still in progress.\n\n' +
          'Be honest in the assessment. A detection that exists but is disabled, untuned, or firing into a queue nobody reads is not coverage, and recording it as such produces a map that flatters and misleads.\n\n' +
          'Use the map to prioritise. Gaps on techniques relevant to your environment and commonly used matter more than exotic ones.\n\n' +
          'Re-map periodically. Coverage decays as systems change, and a map from two years ago describes an environment that no longer exists.',
      },
      {
        lessonId: 'yoddha-m12-l06',
        title: '12.6 Remediation Planning',
        duration: '24 mins',
        subject: 'CYBERSECURITY',
        summary: 'Turning an assessment into a sequenced, resourced plan people will follow.',
        content:
          'A remediation plan that lists everything wrong in severity order is a list, not a plan. A plan accounts for sequence, resource and dependency.\n\n' +
          'Sequence matters because some fixes enable others. Asset inventory precedes patching coverage. Central logging precedes detection. Identity cleanup precedes meaningful access review. Attempting these out of order produces work that has to be redone.\n\n' +
          'Resource honestly. A plan requiring more effort than the team has will be partially executed, and the parts not executed will be chosen by whoever is busiest rather than by importance.\n\n' +
          'Group work into a small number of themes with visible outcomes. Forty individual findings produce no sense of progress; four themes with completion criteria do, and they survive changes in personnel.\n\n' +
          'Include what you are deliberately not doing, with the reasoning. A plan that silently omits accepted risks appears complete and is not, and the omission surfaces at the worst moment.',
      },
      {
        lessonId: 'yoddha-m12-l07',
        title: '12.7 Security Validation',
        duration: '22 mins',
        subject: 'CYBERSECURITY',
        summary: 'Proving controls work, rather than assuming they do.',
        content:
          'A control that has never been tested is an assumption. Validation converts assumptions into evidence.\n\n' +
          'Validate at three levels. Existence: is the control deployed everywhere it should be? Configuration: is it configured as intended? Effectiveness: does it actually stop or detect what it is supposed to?\n\n' +
          'Most organisations validate the first and assume the other two, which is how an endpoint agent installed on every machine turns out to have been in monitor-only mode for a year.\n\n' +
          'Effectiveness testing uses safe, authorised simulations of technique - not real attacks. The question is whether the expected telemetry appeared, whether the detection fired, and whether anyone responded. Each link can break independently, and testing end to end is the only way to find which.\n\n' +
          'Record results and retest after change. A control validated once and never again is an assumption with a date on it.\n\n' +
          'Validation frequently produces the most useful findings in a security programme, because it discovers the controls everyone believed were working.',
      },
    ],
    quizzes: [],
    tasks: [
      {
        taskId: 'yoddha-m12-a01',
        title: 'Defensive Security Improvement Plan',
        type: 'Activity',
        subject: 'CYBERSECURITY',
        urgency: 'high',
        pointsReward: 90,
        dueOffsetDays: 21,
        iconName: 'ShieldCheck',
        description:
          'Turn an assessment into a plan somebody could actually execute.\n\n' +
          'THE FINDINGS. An external assessment of a 200-person company reports:\n' +
          '  F1 (Critical) Internet-facing VPN appliance unpatched, public exploit available\n' +
          '  F2 (Critical) Domain administrator rights held by 14 accounts, 9 of which have not used them in 6 months\n' +
          '  F3 (High)     No central log collection; logs local, 7-day retention\n' +
          '  F4 (High)     Flat network; no segmentation between user devices and servers\n' +
          '  F5 (High)     No MFA on remote access or email\n' +
          '  F6 (Medium)   34 systems missing patches over 90 days old\n' +
          '  F7 (Medium)   No asset inventory; the assessment found 3 servers IT did not know about\n' +
          '  F8 (Medium)   Endpoint agent installed but in monitor-only mode on 40% of devices\n' +
          '  F9 (Low)      Legacy protocols enabled across the estate\n' +
          '  F10 (Low)     Password policy permits 8-character passwords\n\n' +
          'CONSTRAINTS: two IT staff, one of whom handles helpdesk. No new headcount. Modest budget. The business will not accept more than one planned outage per quarter.\n\n' +
          'PRODUCE:\n' +
          '1. A sequenced plan in four themes, not a severity-ordered list. Name each theme and its completion criteria.\n' +
          '2. Justify your sequence, identifying at least two dependencies where one fix must precede another, and explain why doing them in severity order would cause rework.\n' +
          '3. Say which finding you would do first and why - and if it is not F1 or F2, defend that.\n' +
          '4. For F8, explain why this finding is more serious than its Medium rating suggests, using the validation levels from lesson 12.7.\n' +
          '5. Identify what you would deliberately not do this year, with reasoning and a review date.\n' +
          '6. State how you would verify each theme is genuinely complete rather than reported complete.\n' +
          '7. A one-paragraph summary for a non-technical director explaining what the plan achieves and what risk remains after it.\n\n' +
          'Assessed on: whether the plan is executable by two people, whether the dependencies are real, whether item 4 shows you understood that deployment is not effectiveness, and whether item 5 is an honest engineering decision rather than an omission.',
      },
    ],
  },
];

export default OPERATIONS;
