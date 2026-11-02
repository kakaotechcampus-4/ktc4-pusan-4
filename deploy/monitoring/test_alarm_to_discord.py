"""실행: python3 -m unittest discover -s deploy/monitoring"""

import copy
import os
import unittest
from unittest import mock

import alarm_to_discord as subject

# AWS 문서의 Lambda 알람 액션 이벤트 예시를 우리 알람 이름으로 바꾼 것.
EVENT = {
    "source": "aws.cloudwatch",
    "alarmArn": "arn:aws:cloudwatch:ap-northeast-2:123456789012:alarm:ktc4-ec2-cpu-high",
    "accountId": "123456789012",
    "time": "2026-11-03T05:00:00.000+0000",
    "region": "ap-northeast-2",
    "alarmData": {
        "alarmName": "ktc4-ec2-cpu-high",
        "state": {
            "value": "ALARM",
            "reason": "Threshold Crossed: 2 out of the last 2 datapoints were greater than or equal to the threshold (80.0).",
            "timestamp": "2026-11-03T05:00:00.000+0000",
        },
        "previousState": {"value": "OK", "reason": "", "timestamp": "2026-11-03T04:00:00.000+0000"},
        "configuration": {"description": "EC2 CPU 80% 이상이 10분 동안 이어짐", "metrics": []},
    },
}


class BuildPayloadTest(unittest.TestCase):
    def test_alarm_message(self):
        payload = subject.build_payload(EVENT)

        self.assertEqual(
            payload["content"],
            "**🚨 장애** `ktc4-ec2-cpu-high`\n"
            "EC2 CPU 80% 이상이 10분 동안 이어짐\n"
            "상태: OK → ALARM\n"
            "이유: Threshold Crossed: 2 out of the last 2 datapoints were greater than or equal to the threshold (80.0).\n"
            "<https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home"
            "?region=ap-northeast-2#alarmsV2:alarm/ktc4-ec2-cpu-high>",
        )
        self.assertEqual(payload["allowed_mentions"], {"parse": []})
        self.assertEqual(payload["flags"], 4)

    def test_ok_message_without_description(self):
        event = copy.deepcopy(EVENT)
        event["alarmData"]["state"]["value"] = "OK"
        event["alarmData"]["previousState"]["value"] = "ALARM"
        event["alarmData"]["configuration"].pop("description")

        lines = subject.build_payload(event)["content"].split("\n")

        self.assertEqual(lines[0], "**✅ 복구** `ktc4-ec2-cpu-high`")
        self.assertEqual(lines[1], "상태: ALARM → OK")

    def test_long_reason_fits_discord_limit(self):
        event = copy.deepcopy(EVENT)
        event["alarmData"]["state"]["reason"] = "x" * 5000

        content = subject.build_payload(event)["content"]

        self.assertLessEqual(len(content), subject.CONTENT_LIMIT)
        self.assertIn("x…", content)
        self.assertTrue(content.endswith(">"))  # 콘솔 링크는 잘리지 않는다

    def test_alarm_name_is_url_encoded(self):
        url = subject.console_url("ap-northeast-2", "ktc4 a/b")
        self.assertTrue(url.endswith("#alarmsV2:alarm/ktc4%20a%2Fb"))


class HandlerTest(unittest.TestCase):
    def test_posts_to_webhook_from_env(self):
        sent = []
        with mock.patch.dict(os.environ, {"DISCORD_WEBHOOK_URL": "https://discord.test/hook"}):
            result = subject.handler(EVENT, None, post=lambda url, payload: sent.append((url, payload)))

        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0][0], "https://discord.test/hook")
        self.assertEqual(sent[0][1], subject.build_payload(EVENT))
        self.assertEqual(result, {"alarm": "ktc4-ec2-cpu-high", "state": "ALARM"})

    def test_post_failure_propagates(self):
        def fail(url, payload):
            raise OSError("discord down")

        with mock.patch.dict(os.environ, {"DISCORD_WEBHOOK_URL": "https://discord.test/hook"}):
            with self.assertRaises(OSError):
                subject.handler(EVENT, None, post=fail)

    def test_post_discord_sets_user_agent(self):
        with mock.patch.object(subject.urllib.request, "urlopen") as urlopen:
            subject.post_discord("https://discord.test/hook", {"content": "hi"})

        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_header("User-agent"), "ktc4-alarm-to-discord")
        self.assertEqual(request.get_method(), "POST")


if __name__ == "__main__":
    unittest.main()
