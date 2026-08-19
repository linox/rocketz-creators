import { CreatorProfileClient } from "./CreatorProfileClient";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function CreatorProfilePage() {
  return <CreatorProfileClient />;
}
