FROM python:3.8-alpine

RUN apk add build-base nodejs npm yarn

RUN pip3 install solc-select && solc-select install 0.8.19 && solc-select use 0.8.19

RUN pip3 install slither-analyzer

WORKDIR /repo
COPY package.json /repo/package.json
COPY yarn.lock /repo/yarn.lock

RUN yarn install --frozen-lockfile

COPY . /repo

ENTRYPOINT [ "slither" ]
