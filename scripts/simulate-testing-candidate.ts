import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INTERVIEW_ID = "cmmutsjt1000f4k8ejc2l39gy";

const TRANSCRIPT: { speaker: string; content: string; timestampMs: number }[] = [
  { speaker: "interviewer", content: "Good morning! Thank you for coming in today. My name is Dr. Williams, I'll be conducting this interview for the Registered Nurse position in our Med-Surg unit. Could you please introduce yourself?", timestampMs: 0 },
  { speaker: "candidate", content: "Good morning Dr. Williams! My name is Testing Candidate. I'm a registered nurse with about 4 years of experience, mostly in acute care and medical-surgical settings. I graduated from the University of Florida with my BSN in 2022 and I've been working at Tampa General Hospital since then.", timestampMs: 15000 },
  { speaker: "interviewer", content: "That's great. Can you tell me about your typical patient load and the types of patients you've been caring for?", timestampMs: 35000 },
  { speaker: "candidate", content: "At Tampa General, I typically manage 5 to 6 patients per shift on a 36-bed med-surg unit. My patients range from post-surgical recovery, including hip and knee replacements, to chronic disease management like COPD exacerbations and heart failure. I also handle pre-operative assessments and patient education for discharge planning.", timestampMs: 55000 },
  { speaker: "interviewer", content: "That sounds like a solid workload. Can you walk me through a challenging situation you've encountered and how you handled it?", timestampMs: 80000 },
  { speaker: "candidate", content: "Absolutely. About six months ago, I had a post-op patient whose blood pressure started dropping rapidly — went from 130 over 80 to 85 over 50 within twenty minutes. I immediately recognized signs of internal bleeding, elevated the legs, started a fluid bolus, and called a rapid response. The patient was taken back to the OR within the hour. The attending surgeon later told me my quick assessment probably saved the patient's life. It reinforced how critical it is to trust your clinical instincts.", timestampMs: 100000 },
  { speaker: "interviewer", content: "That's an impressive response. What EHR systems are you comfortable with?", timestampMs: 140000 },
  { speaker: "candidate", content: "I've been using Epic for my entire career at Tampa General. I'm very comfortable with it — charting, medication administration records, care plans, and order entry. I've also helped train three new nurses on Epic workflows when they joined our unit. Additionally, I have some experience with Cerner from my clinical rotations.", timestampMs: 160000 },
  { speaker: "interviewer", content: "Excellent. Teamwork is really important in our unit. How do you handle disagreements or conflicts with colleagues?", timestampMs: 190000 },
  { speaker: "candidate", content: "I believe in addressing issues directly but respectfully. For example, I once had a situation where a fellow nurse was consistently not completing her handoff reports thoroughly, which affected patient safety. Instead of going to management, I approached her privately, expressed my concerns about patient continuity, and we worked out a handoff checklist together. It actually ended up being adopted by the whole unit.", timestampMs: 210000 },
  { speaker: "interviewer", content: "That's a great example of leadership. What made you interested in this particular position at our facility?", timestampMs: 250000 },
  { speaker: "candidate", content: "I've heard really positive things about your patient-centered care model. I'm particularly drawn to the fact that you have a 4-to-1 nurse-patient ratio, which allows for better quality care. Also, I'm looking to grow professionally, and I know your facility offers tuition reimbursement for advanced degrees. I'm considering pursuing my MSN in the next couple of years.", timestampMs: 270000 },
  { speaker: "interviewer", content: "We do support continuing education. What about your availability — any scheduling preferences?", timestampMs: 310000 },
  { speaker: "candidate", content: "I'm currently on night shift but I'm very open to day shift, which I understand this position requires. I can start within two weeks of receiving an offer. I'm also flexible with weekends and holidays — I understand that's part of nursing.", timestampMs: 330000 },
  { speaker: "interviewer", content: "Perfect. Do you have any questions for me about the role or our facility?", timestampMs: 360000 },
  { speaker: "candidate", content: "Yes, I have a couple. First, what does the orientation process look like for new nurses joining the unit? And second, are there opportunities for charge nurse or leadership roles down the line?", timestampMs: 380000 },
  { speaker: "interviewer", content: "Great questions. Our orientation is typically 6 to 8 weeks with a dedicated preceptor. And yes, we do have a clinical ladder program — many of our charge nurses started in staff positions. We'll be in touch within the next week. Thank you for your time today!", timestampMs: 400000 },
  { speaker: "candidate", content: "Thank you so much, Dr. Williams. I really appreciate the opportunity and I'm very excited about the possibility of joining your team.", timestampMs: 430000 },
];

async function main() {
  console.log("Starting simulation for Testing candidate...");

  // Clear existing data for this interview
  await prisma.interviewTranscript.deleteMany({ where: { interviewId: INTERVIEW_ID } });
  await prisma.interviewNote.deleteMany({ where: { interviewId: INTERVIEW_ID } });
  await prisma.interviewSummary.deleteMany({ where: { interviewId: INTERVIEW_ID } });
  console.log("Cleared existing data.");

  // Insert transcript segments
  for (const seg of TRANSCRIPT) {
    await prisma.interviewTranscript.create({
      data: {
        interviewId: INTERVIEW_ID,
        speaker: seg.speaker,
        content: seg.content,
        timestampMs: seg.timestampMs,
        confidence: 0.95 + Math.random() * 0.04,
      },
    });
  }
  console.log(`Inserted ${TRANSCRIPT.length} transcript segments.`);

  // DON'T mark as completed yet — let the user generate notes/summary from the room page
  // The interview stays in "upcoming" so the user can test the room
  console.log("Done! Visit the interview room to generate notes and summary.");
  console.log(`URL: http://localhost:3000/interviews/${INTERVIEW_ID}/room`);

  await prisma.$disconnect();
}

main().catch(console.error);
