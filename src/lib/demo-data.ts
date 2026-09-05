import type { Certificate } from "./types";

export const NETWORK = {
  name: "Polygon Amoy",
  chainId: 80002,
  contract: "CertChainRegistry",
  contractAddress: "0x9C41ba7fD3a1E0Cd4E2a17b6E30fD2c9A1b47E30",
  rpc: "https://rpc-amoy.polygon.technology",
  explorer: "https://amoy.polygonscan.com",
};

export const ORGANIZATION = {
  name: "Hindustan Institute of Technology & Science",
  shortName: "HITS",
  domain: "hindustanuniv.ac.in",
  contactEmail: "registrar@hindustanuniv.ac.in",
  wallet: "0x71E8a4C7bF29d0a4C0Ff31B8a4A9E2f7d3C4C91A",
  signatory: "Dr. Meera Raghavan",
  signatoryTitle: "Registrar",
};

function chain(
  tx: string,
  block: number,
  confirmedAt: string,
  revoked?: { tx: string; at: string },
) {
  return {
    network: NETWORK.name,
    chainId: NETWORK.chainId,
    contract: NETWORK.contract,
    issuerWallet: ORGANIZATION.wallet,
    transactionHash: tx,
    block,
    confirmedAt,
    ...(revoked ? { revocationTransactionHash: revoked.tx, revokedAt: revoked.at } : {}),
  };
}

export const DEMO_CERTIFICATES: Certificate[] = [
  {
    id: "CERT-2026-002841",
    recipientName: "Aarav Krishnan",
    recipientEmail: "aarav.krishnan@student.hindustanuniv.ac.in",
    course: "Bachelor of Technology in Computer Science and Engineering",
    type: "Degree",
    organization: ORGANIZATION.name,
    issueDate: "2026-05-18",
    description: "Awarded with First Class Distinction, CGPA 9.24.",
    hash: "0x8f4c7e1d5a93b0c62f8e47d1a05c9b3e7f26d84a19c53b7e0d6a2f915c74b92a",
    status: "active",
    chain: chain(
      "0x42a1c93e7f10b2d854ac6e31f97b0d25aa48c6139e7b0524cd31f7a9be5c8f93",
      12884301,
      "2026-05-18T09:42:11Z",
    ),
  },
  {
    id: "CERT-2026-002840",
    recipientName: "Ishita Menon",
    recipientEmail: "ishita.menon@student.hindustanuniv.ac.in",
    course: "Advanced Machine Learning Specialisation",
    type: "Completion",
    organization: ORGANIZATION.name,
    issueDate: "2026-05-12",
    hash: "0x3b91d4f7c208a65e19bd730f4a82c1e95d6403b8f27ae14c90d5b6e3812af74c",
    status: "active",
    chain: chain(
      "0x77bd2e91a4c3057fe618b9d02473ca85f19e6d03b7c41a25e9f8d641093b7c22",
      12871552,
      "2026-05-12T11:05:47Z",
    ),
  },
  {
    id: "CERT-2026-002807",
    recipientName: "Rohan Verma",
    recipientEmail: "rohan.verma@student.hindustanuniv.ac.in",
    course: "Summer Internship — Cloud Infrastructure",
    type: "Internship",
    organization: ORGANIZATION.name,
    issueDate: "2026-04-02",
    hash: "0xc71a08e94d3b52f6108ae74b93c5d02f8b6417ea395d0c28b74f1e6a9d3025bb",
    status: "revoked",
    chain: chain(
      "0x18fe4a72b93d015ce7480af6215b93cd07e4a81f36b9d20c5e7148a3fd90b217",
      12640118,
      "2026-04-02T08:12:03Z",
      {
        tx: "0x9dc70e18b4a3f205e916c74bd308a2f1e0947b6ad25c8318a740eb62915cd304",
        at: "2026-06-21T14:30:58Z",
      },
    ),
  },
  {
    id: "CERT-2026-002793",
    recipientName: "Nandini Iyer",
    recipientEmail: "nandini.iyer@student.hindustanuniv.ac.in",
    course: "Excellence in Robotics Research",
    type: "Excellence",
    organization: ORGANIZATION.name,
    issueDate: "2026-03-14",
    hash: "0x5e2b90c47a13df86025bc9e741038af26d5b19c73e04a8f21b6d095c3742ea18",
    status: "active",
    chain: chain(
      "0x60ac13d5e78b024fa9137c6e5b08d241fa73c9e60b18d5273af0916cb8471d0a",
      12501907,
      "2026-03-14T16:22:39Z",
    ),
  },
  {
    id: "CERT-2026-002754",
    recipientName: "Kabir Salunke",
    recipientEmail: "kabir.salunke@student.hindustanuniv.ac.in",
    course: "National Symposium on Sustainable Design",
    type: "Participation",
    organization: ORGANIZATION.name,
    issueDate: "2026-02-27",
    hash: "0xa04f7c31e962b58d1740ce93a5f218bd60937c4e1a85d2f096b3e7481cd5a290",
    status: "active",
    chain: chain(
      "0x2bf901e74d3ac6058be417f92d30ca6718be05d94317fa62c08e5b7d1946ac03",
      12430774,
      "2026-02-27T10:01:12Z",
    ),
  },
  {
    id: "CERT-2026-002712",
    recipientName: "Sara Fernandes",
    recipientEmail: "sara.fernandes@student.hindustanuniv.ac.in",
    course: "Certified Secure Systems Engineer",
    type: "Certification",
    organization: ORGANIZATION.name,
    issueDate: "2026-01-30",
    hash: "0xd318b7f0a4e926c53b8017df46a29c05e7314bd820f96ae5c1d704b382916a55",
    status: "pending",
    chain: chain(
      "0x53cd07a941e8b26f0c73d5148ba902e7fd6413c890a52b7e1064f3d8ca719b45",
      12388002,
      "2026-01-30T13:44:20Z",
    ),
  },
];

export const DEMO_HASHES = {
  verified: "0x8f4c7e1d5a93b0c62f8e47d1a05c9b3e7f26d84a19c53b7e0d6a2f915c74b92a",
  revoked: "0xc71a08e94d3b52f6108ae74b93c5d02f8b6417ea395d0c28b74f1e6a9d3025bb",
  notFound: "0x0000feedfacecafebeef1122334455667788990011223344556677889900aabb",
};

export const ISSUANCE_SERIES = [
  { month: "Sep", issued: 78, revoked: 2 },
  { month: "Oct", issued: 112, revoked: 4 },
  { month: "Nov", issued: 96, revoked: 1 },
  { month: "Dec", issued: 140, revoked: 5 },
  { month: "Jan", issued: 168, revoked: 3 },
  { month: "Feb", issued: 154, revoked: 6 },
  { month: "Mar", issued: 187, revoked: 4 },
  { month: "Apr", issued: 203, revoked: 5 },
  { month: "May", issued: 246, revoked: 4 },
];

export const VERIFICATION_SERIES = [
  { day: "Mon", checks: 128 },
  { day: "Tue", checks: 164 },
  { day: "Wed", checks: 142 },
  { day: "Thu", checks: 198 },
  { day: "Fri", checks: 231 },
  { day: "Sat", checks: 96 },
  { day: "Sun", checks: 71 },
];

export const DASHBOARD_METRICS = {
  total: 1284,
  verified: 1196,
  active: 1250,
  revoked: 34,
};

export const SAMPLE_CSV = `name,email,course,date,type
Aarav Krishnan,aarav.krishnan@example.edu,B.Tech Computer Science and Engineering,2026-05-18,Degree
Ishita Menon,ishita.menon@example.edu,Advanced Machine Learning Specialisation,2026-05-12,Completion
Rohan Verma,rohan.verma@example.edu,Summer Internship — Cloud Infrastructure,2026-04-02,Internship
`;
