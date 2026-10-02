"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type Faq = { question: string; answer: string };

/**
 * Static platform FAQ copy (not company- or recruitment-specific, so it is
 * not subject to the "no hardcoded content" rule -- there is nothing here
 * an admin needs to edit without a redeploy).
 */
const faqs: Faq[] = [
  {
    question: "Is PlacementWays free?",
    answer:
      "You can browse public preparation content and try an eligible first mock for free. Optional premium courses and mocks show their price before checkout when purchases are enabled.",
  },
  {
    question: "Are recruitment processes guaranteed to be exact?",
    answer:
      "No. Recruitment patterns can change. Each process should include a source and last-verified date so students can judge the information appropriately.",
  },
  {
    question: "Can I practice for multiple companies?",
    answer:
      "Yes. The platform is designed around company-wise preparation, and more companies can be added over time.",
  },
  {
    question: "Can I run and submit coding solutions?",
    answer:
      "Yes. Browse problems and write code without an account. Sign in to run examples and submit solutions for grading when execution is enabled. Your submitted results are saved in your coding history.",
  },
];

export function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section id="faq">
      <div className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--color-accent)]">Questions</p>
          <h2 className="mt-3 font-serif text-4xl sm:text-5xl">Frequently asked questions.</h2>
        </div>
        <div className="mt-10 divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {faqs.map((faq, index) => (
            <div key={faq.question}>
              <button
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-sm font-semibold"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                aria-expanded={openFaq === index}
              >
                {faq.question}
                <ChevronDown size={18} className={`shrink-0 transition-transform ${openFaq === index ? "rotate-180" : ""}`} />
              </button>
              {openFaq === index && <p className="pb-5 pr-8 text-sm leading-7 text-[var(--color-ink)]/65">{faq.answer}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
