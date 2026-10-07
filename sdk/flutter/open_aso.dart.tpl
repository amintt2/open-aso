import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:ui';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

class OpenAso {
  static const _baseUrl = '__OPEN_ASO_URL__';
  static const _sdkToken = '__OPEN_ASO_TOKEN__';
  static const _bundleId = '__BUNDLE_ID__';
  static const _channel = MethodChannel('open_aso/attribution');

  static Future<String> userId() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString('open_aso.user_id');
    if (existing != null) return existing;
    final random = Random.secure();
    final created = List.generate(16, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    await prefs.setString('open_aso.user_id', created);
    return created;
  }

  static Future<bool> _post(String path, Map<String, String?> body) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl$path'),
        headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $_sdkToken'},
        body: jsonEncode(body..removeWhere((_, v) => v == null)),
      );
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  static Future<String> start() async {
    final prefs = await SharedPreferences.getInstance();
    final id = await userId();
    await Purchases.setAttributes({'openAsoId': id});
    if (!(prefs.getBool('open_aso.install_sent') ?? false)) {
      String? token;
      if (Platform.isIOS) {
        try {
          token = await _channel.invokeMethod<String>('attributionToken');
        } catch (_) {}
      }
      final country = PlatformDispatcher.instance.locale.countryCode;
      final ok = await _post('/api/attribution/install', {'bundleId': _bundleId, 'userId': id, 'adServicesToken': token, 'country': country});
      if (ok) await prefs.setBool('open_aso.install_sent', true);
    }
    await _post('/api/attribution/event', {'bundleId': _bundleId, 'userId': id, 'name': 'session'});
    return id;
  }
}
