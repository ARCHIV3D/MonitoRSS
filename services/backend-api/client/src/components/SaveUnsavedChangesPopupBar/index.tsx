import { useFormContext } from "react-hook-form";
import { Button, Flex, HStack, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { isEqual } from "lodash";
import { AnimatedComponent } from "../AnimatedComponent";

export const SavedUnsavedChangesPopupBar = () => {
  const { t } = useTranslation();
  const {
    formState: { isSubmitting, isValid, defaultValues },
    reset,
    getValues,
  } = useFormContext();

  /**
   * react-hook-form isDirty does not report true in some cases
   * such as when setting an empty array for a field that was previously
   * populated (happens with custom placeholders)
   */
  const isDirty = !isEqual(getValues(), defaultValues);

  return (
    <AnimatedComponent>
      {isDirty && (
        <Flex
          as={motion.div}
          direction="row-reverse"
          position="fixed"
          bottom="-100px"
          left="50%"
          opacity="0"
          zIndex={100}
          transform="translate(-50%, -50%)"
          width={["90%", "90%", "80%", "80%", "1200px"]}
          borderRadius="md"
          paddingX={4}
          paddingY={2}
          bg="blue.600"
          animate={{ opacity: 1, bottom: "0px" }}
          exit={{ opacity: 0, bottom: "-100px" }}
        >
          <HStack justifyContent="space-between" width="100%">
            <Text>You have unsaved changes!</Text>
            <HStack>
              <Button
                onClick={() => reset(defaultValues)}
                variant="ghost"
                isDisabled={!isDirty || isSubmitting}
              >
                {t("features.feed.components.sidebar.resetButton")}
              </Button>
              <Button
                type="submit"
                colorScheme="blue"
                isDisabled={isSubmitting || !isDirty || !isValid}
                isLoading={isSubmitting}
              >
                {t("features.feed.components.sidebar.saveButton")}
              </Button>
            </HStack>
          </HStack>
        </Flex>
      )}
    </AnimatedComponent>
  );
};
