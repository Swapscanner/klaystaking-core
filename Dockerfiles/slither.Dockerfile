FROM python:3.8-alpine

RUN apk add build-base nodejs npm yarn

RUN pip3 install solc-select && solc-select install 0.8.19 && solc-select use 0.8.19

RUN pip3 install slither-analyzer

WORKDIR /repo
COPY package.json /repo/package.json
COPY yarn.lock /repo/yarn.lock

RUN mkdir -p scripts/git/hooks && \
  mkdir -p .git/hooks && \
  echo '' > scripts/git/hooks/pre-commit.sh && \
  chmod +x scripts/git/hooks/pre-commit.sh && \
  yarn

COPY . /repo

ENTRYPOINT [ "slither" ]
