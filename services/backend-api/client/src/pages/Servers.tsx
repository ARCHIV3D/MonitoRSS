import { ArrowForwardIcon, SearchIcon } from "@chakra-ui/icons";
import {
  AbsoluteCenter,
  Alert,
  AlertIcon,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Loading, Menu } from "@/components";
import { useDiscordServers } from "../features/discordServers";
import { pages } from "../constants";

const Servers: React.FC = () => {
  const navigate = useNavigate();
  const { status, data, error } = useDiscordServers();
  const [search, setSearch] = useState("");

  return (
    <Flex
      justifyContent="center"
      alignItems="center"
      width="100%"
      px="8"
      paddingY={16}
      // marginTop="8rem"
    >
      <Stack maxWidth="lg" width="100%" spacing={8}>
        <Stack spacing={8} position="relative">
          <Stack
            borderWidth="3px"
            borderStyle="solid"
            borderColor="purple.200"
            padding={4}
            borderRadius="lg"
            spacing={8}
          >
            <Stack>
              <Heading> Manage personal feeds</Heading>
              <Text>A new type of feed that&apos;s more reliable, flexible, and customizable.</Text>
            </Stack>
            <Button
              colorScheme="purple"
              rightIcon={<ArrowForwardIcon />}
              justifyContent="space-between"
              onClick={() => navigate(pages.userFeeds())}
            >
              Manage Personal Feeds
            </Button>
          </Stack>
          <Flex position="relative" alignItems="center">
            <AbsoluteCenter px="4">or</AbsoluteCenter>
            <Divider />
          </Flex>
        </Stack>
        <Stack width="100%">
          <Stack spacing={8}>
            <Stack>
              <Heading>Manage legacy feeds</Heading>
              <Text>
                If you have not used personal feeds, then your feeds are legacy be default. Select
                your server to get started.
              </Text>
            </Stack>
            <Stack
              spacing={4}
              bg={useColorModeValue("white", "gray.700")}
              padding="4"
              rounded="lg"
              shadow="lg"
              height="500px"
            >
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <SearchIcon color="gray.300" />
                </InputLeftElement>
                <Input placeholder="Search..." onChange={(e) => setSearch(e.target.value)} />
              </InputGroup>
              {status === "loading" && (
                <Box textAlign="center">
                  <Loading size="lg" />
                </Box>
              )}
              {status === "success" && data && (
                <Box overflow="auto" height="100%">
                  <Menu
                    items={data.results
                      .filter((server) =>
                        search ? server.name.toLowerCase().includes(search.toLowerCase()) : true
                      )
                      .map((server) => ({
                        id: server.id,
                        title: server.name,
                        value: server.id,
                        description: "",
                        icon: server.iconUrl,
                      }))}
                    onSelectedValue={(value) => navigate(`/servers/${value}/feeds`)}
                    shown
                  />
                </Box>
              )}
              {error && (
                <Alert status="error" title="Failed to get list of servers">
                  <AlertIcon />
                  {error.message}
                </Alert>
              )}
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Flex>
  );
};

export default Servers;
