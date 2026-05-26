import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
const BasicAccordion = () => {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger className="cursor-pointer">
          How does Dashcode work?
        </AccordionTrigger>
        <AccordionContent>
          Journalist call this critical, introductory section the and when bridge properly executed,
          it is the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger className="cursor-pointer">Where I can learn more about using Dashcode?</AccordionTrigger>
        <AccordionContent>
          Journalist call this critical, introductory section the and when bridge properly executed,
          it is the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger className="cursor-pointer">Why Dashcode is so important?</AccordionTrigger>
        <AccordionContent>
          Journalist call this critical, introductory section the and when bridge properly executed,
          it is the that carries your reader from anheadine try at attention-grabbing to the body of your blog post.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default BasicAccordion;