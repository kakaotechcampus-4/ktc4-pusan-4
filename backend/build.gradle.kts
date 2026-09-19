plugins {
    java
    jacoco
    pmd
    id("org.springframework.boot") version "3.5.16"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.ktc4.pusan4"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

jacoco {
    toolVersion = "0.8.13"
}

pmd {
    toolVersion = "7.27.0"
    ruleSetFiles = files("config/pmd/ruleset.xml")
    ruleSets = emptyList()
    isIgnoreFailures = true
}

val cpdRuntime by configurations.creating

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("com.fasterxml.jackson.dataformat:jackson-dataformat-yaml")
    implementation("com.github.f4b6a3:uuid-creator:6.1.1")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    cpdRuntime("net.sourceforge.pmd:pmd-cli:7.27.0")
    cpdRuntime("net.sourceforge.pmd:pmd-java:7.27.0")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}

tasks.test {
    exclude("**/*IntegrationTest.class")
    // 레포 루트의 평가셋·규칙카드를 입력으로 추적한다. 없으면 YAML만 고쳐도 테스트가 UP-TO-DATE로 건너뛴다.
    val evalRulesDir = providers.environmentVariable("EVAL_RULES_DIR").orElse("../rules")
    inputs.property("evalRulesDir", evalRulesDir)
    inputs.files(fileTree("../eval"), fileTree(evalRulesDir))
}

val integrationTestTask = tasks.register<Test>("integrationTest") {
    description = "Runs integration tests."
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    testClassesDirs = sourceSets.test.get().output.classesDirs
    classpath = sourceSets.test.get().runtimeClasspath
    include("**/*IntegrationTest.class")
    shouldRunAfter(tasks.test)
}

tasks.check {
    dependsOn(integrationTestTask)
}

tasks.named("pmdTest") {
    enabled = false
}

tasks.withType<org.gradle.api.plugins.quality.Pmd>().configureEach {
    reports {
        xml.required.set(true)
        html.required.set(false)
    }
}

val jacocoCombinedReport = tasks.register<org.gradle.testing.jacoco.tasks.JacocoReport>("jacocoCombinedReport") {
    description = "Generates combined JaCoCo coverage for unit and integration tests."
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    dependsOn(tasks.test, integrationTestTask)
    executionData(
        layout.buildDirectory.file("jacoco/test.exec"),
        layout.buildDirectory.file("jacoco/integrationTest.exec"),
    )
    sourceDirectories.setFrom(sourceSets.main.get().allSource.srcDirs)
    classDirectories.setFrom(sourceSets.main.get().output)

    reports {
        xml.required.set(true)
        xml.outputLocation.set(layout.buildDirectory.file("reports/jacoco/combined.xml"))
        html.required.set(false)
        csv.required.set(false)
    }
}

val cpdMain = tasks.register<JavaExec>("cpdMain") {
    description = "Generates a PMD CPD report for production Java sources."
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    classpath = cpdRuntime
    mainClass.set("net.sourceforge.pmd.cli.PmdCli")

    val reportFile = layout.buildDirectory.file("reports/cpd/main.xml")
    inputs.dir("src/main/java")
    outputs.file(reportFile)
    doFirst {
        reportFile.get().asFile.parentFile.mkdirs()
    }
    args(
        "cpd",
        "--minimum-tokens", "100",
        "--language", "java",
        "--format", "xml",
        "--report-file", reportFile.get().asFile.absolutePath,
        "--no-fail-on-violation",
        "--dir", file("src/main/java").absolutePath,
        "--relativize-paths-with", projectDir.absolutePath,
    )
}

tasks.register("codeHealthReports") {
    description = "Generates coverage, PMD, and CPD reports for the quality bot."
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    dependsOn(jacocoCombinedReport, tasks.named("pmdMain"), cpdMain)
}
