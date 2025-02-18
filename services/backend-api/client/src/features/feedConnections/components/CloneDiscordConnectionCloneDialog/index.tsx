import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { cloneElement, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { InferType, object, string } from "yup";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useCreateDiscordChannelConnectionClone,
  useCreateDiscordWebhookConnectionClone,
} from "../../hooks";
import { pages } from "../../../../constants";
import { FeedConnectionType } from "../../../../types";
import { notifyError } from "../../../../utils/notifyError";
import { notifySuccess } from "../../../../utils/notifySuccess";

const formSchema = object({
  name: string().required(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  feedId: string;
  connectionId: string;
  type: FeedConnectionType;
  defaultValues: {
    name: string;
  };
  trigger: React.ReactElement;
}

export const CloneDiscordConnectionCloneDialog = ({
  feedId,
  connectionId,
  type,
  defaultValues,
  trigger,
}: Props) => {
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues,
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const initialRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createChannelClone } = useCreateDiscordChannelConnectionClone();
  const { mutateAsync: createWebhookClone } = useCreateDiscordWebhookConnectionClone();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    reset(defaultValues);
  }, [isOpen]);

  const onSubmit = async ({ name }: FormData) => {
    try {
      let newConnectionId: string;

      if (type === FeedConnectionType.DiscordChannel) {
        const res = await createChannelClone({ feedId, connectionId, details: { name } });
        newConnectionId = res.result.id;
      } else {
        const res = await createWebhookClone({ feedId, connectionId, details: { name } });
        newConnectionId = res.result.id;
      }

      navigate(
        pages.userFeedConnection({
          connectionId: newConnectionId,
          feedId,
          connectionType: type,
        })
      );
      onClose();
      reset({ name });
      notifySuccess(
        t("common.success.savedChanges"),
        "You are now viewing your newly cloned connection"
      );
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), (err as Error).message);
    }
  };

  return (
    <>
      {cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose} initialFocusRef={initialRef}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Clone connection</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <form id="clonefeed" onSubmit={handleSubmit(onSubmit)}>
              <FormControl isInvalid={!!errors.name}>
                <FormLabel>Name</FormLabel>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => <Input {...field} ref={initialRef} />}
                />
                {errors.name && <FormErrorMessage>{errors.name.message}</FormErrorMessage>}
              </FormControl>
            </form>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="ghost">Cancel</Button>
              <Button colorScheme="blue" type="submit" form="clonefeed" isLoading={isSubmitting}>
                Clone
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
