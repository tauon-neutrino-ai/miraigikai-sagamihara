import type { Metadata } from "next";
import { QuestionList } from "@/components/question-list";
import { EmptyState, PageTitle } from "@/components/ui";
import { getQuestions } from "@/lib/data";

export const metadata: Metadata = { title: "一般質問・代表質問" };

export default async function QuestionsPage() {
  const questions = await getQuestions();
  return (
    <div>
      <PageTitle
        title="一般質問・代表質問"
        lead="本会議で議員が行った一般質問と、会派を代表して行う代表質問を、1人1回ずつまとめています。評価は AI が会議録をもとに5つの基準でつけたものです。"
      />
      {questions.length === 0 ? <EmptyState /> : <QuestionList questions={questions} />}
    </div>
  );
}
